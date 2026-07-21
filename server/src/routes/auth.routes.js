// Đăng nhập / đổi mật khẩu — JWT thuần.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { signToken } from '../lib/jwt.js';
import { requireAuth, attachEmployee } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';

const router = Router();

// POST /api/auth/login  body: { email, password }
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.status(400).json({ message: 'Nhập email và mật khẩu' });
    }

    const employee = await prisma.employee.findUnique({
      where: { email },
      include: { department: true },
    });
    if (!employee || !employee.passwordHash) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }
    if (employee.status === 'INACTIVE') {
      return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    }

    const ok = await bcrypt.compare(password, employee.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    const token = signToken(employee);
    const { passwordHash, ...safe } = employee;
    res.json({ token, employee: safe });
  })
);

// POST /api/auth/change-password  body: { oldPassword, newPassword }  (đã đăng nhập)
router.post(
  '/change-password',
  requireAuth,
  attachEmployee,
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới tối thiểu 6 ký tự' });
    }
    const emp = await prisma.employee.findUnique({ where: { id: req.employee.id } });
    // Nếu không phải đổi bắt buộc lần đầu thì kiểm tra mật khẩu cũ.
    if (emp.passwordHash && !emp.mustChangePassword) {
      const ok = await bcrypt.compare(String(oldPassword || ''), emp.passwordHash);
      if (!ok) return res.status(401).json({ message: 'Mật khẩu cũ không đúng' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.employee.update({
      where: { id: emp.id },
      data: { passwordHash: hash, mustChangePassword: false },
    });
    await logAction(req, { action: 'PASSWORD_CHANGE', entity: 'Employee', entityId: emp.id });
    res.json({ message: 'Đã đổi mật khẩu' });
  })
);

export default router;
