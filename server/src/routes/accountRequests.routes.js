// Tự đăng ký tài khoản (chủ yếu cho leader của một line/bộ phận) — phải qua
// ADMIN xét duyệt mới tạo Employee thật và đăng nhập được.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth, attachEmployee, requireRole } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';
import { emitEvent } from '../lib/realtime.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/account-requests  (PUBLIC — không cần đăng nhập)
// body: { email, password, fullName, departmentId, employeeCode?, phone? }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const fullName = String(req.body.fullName || '').trim();
    const { departmentId } = req.body;

    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Email không hợp lệ' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu tối thiểu 6 ký tự' });
    }
    if (!fullName) return res.status(400).json({ message: 'Vui lòng nhập họ tên' });
    if (!departmentId) return res.status(400).json({ message: 'Vui lòng chọn bộ phận bạn phụ trách' });

    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) return res.status(400).json({ message: 'Bộ phận không tồn tại' });

    // Email đã có tài khoản thật -> báo đăng nhập thay vì đăng ký.
    const existingEmp = await prisma.employee.findUnique({ where: { email } });
    if (existingEmp) {
      return res.status(409).json({ message: 'Email này đã có tài khoản. Vui lòng đăng nhập.' });
    }
    const existingReq = await prisma.accountRequest.findUnique({ where: { email } });
    if (existingReq) {
      if (existingReq.status === 'PENDING') {
        return res.status(409).json({ message: 'Yêu cầu với email này đang chờ quản trị viên duyệt.' });
      }
      // Bị từ chối trước đó -> cho đăng ký lại (ghi đè yêu cầu cũ).
      await prisma.accountRequest.delete({ where: { id: existingReq.id } });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const request = await prisma.accountRequest.create({
      data: {
        email,
        passwordHash,
        fullName,
        employeeCode: (req.body.employeeCode || '').trim() || null,
        phone: (req.body.phone || '').trim() || null,
        departmentId: dept.id,
        departmentName: dept.name,
        requestedRole: 'MANAGER',
      },
    });

    // Báo cho admin có yêu cầu mới.
    await prisma.notification.create({
      data: {
        targetRole: 'ADMIN',
        title: 'Có yêu cầu mở tài khoản mới',
        body: `${fullName} (${dept.name}) đăng ký tài khoản trưởng bộ phận.`,
      },
    });
    emitEvent('notification:created', { targetRole: 'ADMIN' });

    res.status(201).json({
      message: 'Đã gửi yêu cầu. Vui lòng chờ quản trị viên duyệt trước khi đăng nhập.',
      id: request.id,
    });
  })
);

// Từ đây trở xuống bắt buộc đăng nhập + quyền ADMIN.
router.use(requireAuth, attachEmployee, requireRole('ADMIN'));

// GET /api/account-requests?status=PENDING
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = {};
    const { status } = req.query;
    if (['PENDING', 'APPROVED', 'REJECTED'].includes(status)) where.status = status;

    const list = await prisma.accountRequest.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      // Không trả passwordHash ra ngoài.
      select: {
        id: true,
        email: true,
        fullName: true,
        employeeCode: true,
        phone: true,
        departmentId: true,
        departmentName: true,
        requestedRole: true,
        status: true,
        reviewNote: true,
        reviewedByName: true,
        reviewedAt: true,
        createdAt: true,
      },
    });
    res.json(list);
  })
);

// POST /api/account-requests/:id/approve  body: { role?, departmentId?, employeeCode? }
// Admin có thể chỉnh vai trò/bộ phận/mã NV trước khi duyệt.
router.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const request = await prisma.accountRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Yêu cầu này đã được xử lý' });
    }

    const role = ['EMPLOYEE', 'MANAGER', 'CANTEEN', 'ADMIN'].includes(req.body.role)
      ? req.body.role
      : request.requestedRole;
    const departmentId = req.body.departmentId || request.departmentId;
    // Mã NV bắt buộc & duy nhất trên Employee — nếu người đăng ký không nhập thì sinh từ email.
    let employeeCode = (req.body.employeeCode || request.employeeCode || '').trim();
    if (!employeeCode) employeeCode = request.email.split('@')[0].toUpperCase().slice(0, 20);

    const dupEmail = await prisma.employee.findUnique({ where: { email: request.email } });
    if (dupEmail) return res.status(409).json({ message: 'Email này đã có tài khoản trong hệ thống' });
    const dupCode = await prisma.employee.findUnique({ where: { employeeCode } });
    if (dupCode) {
      return res.status(409).json({ message: `Mã nhân viên "${employeeCode}" đã tồn tại. Vui lòng nhập mã khác.` });
    }

    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        fullName: request.fullName,
        email: request.email,
        phone: request.phone,
        passwordHash: request.passwordHash, // giữ đúng mật khẩu người dùng đã đặt
        mustChangePassword: false,
        role,
        departmentId: departmentId || null,
        status: 'ACTIVE',
      },
    });

    await prisma.accountRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        reviewedById: req.employee.id,
        reviewedByName: req.employee.fullName,
        reviewedAt: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        employeeId: employee.id,
        title: 'Tài khoản đã được duyệt',
        body: 'Bạn có thể đăng nhập bằng email và mật khẩu đã đăng ký.',
      },
    });

    await logAction(req, {
      action: 'ACCOUNT_REQUEST_APPROVE',
      entity: 'AccountRequest',
      entityId: request.id,
      detail: `${request.fullName} (${request.email}) -> ${role}`,
    });

    res.json({ message: 'Đã duyệt và tạo tài khoản', employeeId: employee.id });
  })
);

// POST /api/account-requests/:id/reject  body: { note }
router.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const request = await prisma.accountRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ message: 'Không tìm thấy yêu cầu' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Yêu cầu này đã được xử lý' });
    }

    await prisma.accountRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewNote: (req.body.note || '').trim() || null,
        reviewedById: req.employee.id,
        reviewedByName: req.employee.fullName,
        reviewedAt: new Date(),
      },
    });

    await logAction(req, {
      action: 'ACCOUNT_REQUEST_REJECT',
      entity: 'AccountRequest',
      entityId: request.id,
      detail: `${request.fullName} (${request.email})`,
    });

    res.json({ message: 'Đã từ chối yêu cầu' });
  })
);

export default router;
