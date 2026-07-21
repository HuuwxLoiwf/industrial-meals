// Module 1: Quản lý nhân viên (CRUD + tìm kiếm + import Excel/CSV). Chỉ ADMIN.
import { Router } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';

const router = Router();

// Upload file Excel/CSV vào bộ nhớ (không lưu disk), giới hạn 5MB.
const uploadSheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Map tiêu đề cột (không dấu, lowercase) -> tên trường chuẩn.
function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

// Lấy giá trị 1 dòng theo nhiều tên cột có thể có.
function pick(row, keys) {
  for (const k of Object.keys(row)) {
    if (keys.includes(normalizeHeader(k))) {
      const v = row[k];
      return v == null ? '' : String(v).trim();
    }
  }
  return '';
}

// GET /api/employees?search=&departmentId=&role=&page=&pageSize=
// Phân trang + tìm kiếm phía server (chịu được hàng nghìn nhân viên).
router.get(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const { search, departmentId, role } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 20));

    const where = {};
    // Mặc định chỉ hiện nhân viên đang hoạt động; ?includeInactive=1 để xem cả người đã vô hiệu hóa.
    if (!req.query.includeInactive) where.status = 'ACTIVE';
    if (req.employee.role === 'MANAGER') {
      where.departmentId = req.employee.departmentId;
    } else if (departmentId) {
      where.departmentId = departmentId;
    }
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where,
        include: { department: true },
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      data: employees.map(({ passwordHash, ...e }) => e),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  })
);

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { employeeCode, fullName, email, phone, role, departmentId, password } = req.body;
    if (!employeeCode || !fullName) {
      return res.status(400).json({ message: 'Thiếu mã hoặc họ tên nhân viên' });
    }
    // Mật khẩu mặc định = mã NV nếu không nhập.
    const passwordHash = await bcrypt.hash(
      String(password || employeeCode).toLowerCase(),
      10
    );
    const employee = await prisma.employee.create({
      data: {
        employeeCode,
        fullName,
        email: email || null,
        phone: phone || null,
        passwordHash,
        role: role || 'EMPLOYEE',
        departmentId: departmentId || null,
      },
      include: { department: true },
    });
    await logAction(req, { action: 'EMPLOYEE_CREATE', entity: 'Employee', entityId: employee.id, detail: employee.fullName });
    res.status(201).json(employee);
  })
);

router.put(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { fullName, email, phone, role, departmentId, status } = req.body;

    // Chặn admin tự hạ quyền hoặc tự vô hiệu hóa chính mình -> tránh tự khóa mình khỏi hệ thống.
    if (req.params.id === req.employee.id) {
      if (role && role !== 'ADMIN') {
        return res.status(400).json({ message: 'Không thể tự đổi vai trò của chính mình' });
      }
      if (status && status !== 'ACTIVE') {
        return res.status(400).json({ message: 'Không thể tự vô hiệu hóa chính mình' });
      }
    }

    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { fullName, email, phone, role, departmentId, status },
      include: { department: true },
    });
    await logAction(req, { action: 'EMPLOYEE_UPDATE', entity: 'Employee', entityId: employee.id, detail: employee.fullName });
    res.json(employee);
  })
);

// Xóa MỀM: chuyển sang INACTIVE thay vì xóa cứng, để giữ lại lịch sử đăng ký/báo cáo.
// Xóa cứng sẽ cascade xóa MealRegistration -> làm sai lệch số liệu báo cáo các tháng trước.
router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.employee.id) {
      return res.status(400).json({ message: 'Không thể tự vô hiệu hóa chính mình' });
    }
    const emp = await prisma.employee.update({
      where: { id: req.params.id },
      data: { status: 'INACTIVE' },
    });
    await logAction(req, { action: 'EMPLOYEE_DEACTIVATE', entity: 'Employee', entityId: emp.id, detail: emp.fullName });
    res.status(204).end();
  })
);

// POST /api/employees/:id/reactivate - kích hoạt lại nhân viên đã vô hiệu hóa.
router.post(
  '/:id/reactivate',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const emp = await prisma.employee.update({
      where: { id: req.params.id },
      data: { status: 'ACTIVE' },
    });
    await logAction(req, { action: 'EMPLOYEE_REACTIVATE', entity: 'Employee', entityId: emp.id, detail: emp.fullName });
    res.json({ message: `Đã kích hoạt lại ${emp.fullName}` });
  })
);

// POST /api/employees/:id/reset-password  -> đặt lại mật khẩu = mã NV, buộc đổi lần sau.
router.post(
  '/:id/reset-password',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const emp = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!emp) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    // Mật khẩu mới: admin nhập, hoặc mặc định = mã NV (lowercase).
    const newPass = String(req.body?.password || emp.employeeCode).toLowerCase();
    const hash = await bcrypt.hash(newPass, 10);
    await prisma.employee.update({
      where: { id: emp.id },
      data: { passwordHash: hash, mustChangePassword: true },
    });
    await logAction(req, {
      action: 'PASSWORD_RESET',
      entity: 'Employee',
      entityId: emp.id,
      detail: emp.fullName,
    });
    res.json({ message: `Đã đặt lại mật khẩu cho ${emp.fullName}`, defaultPassword: newPass });
  })
);

// POST /api/employees/import - import danh sách nhân viên từ file Excel/CSV.
// Cột nhận diện: "Mã NV", "Họ và tên", "Email", "Số điện thoại", "Bộ phận".
// Cột "Bộ phận" phải khớp TÊN BỘ PHẬN ĐÃ CÓ SẴN trong hệ thống (không tự tạo mới)
// để tránh sinh phòng ban rác do lỗi chính tả khi nhập liệu Excel.
router.post(
  '/import',
  requireRole('ADMIN'),
  uploadSheet.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Chưa chọn file' });

    let rows;
    try {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      // Gộp tất cả sheet (file mẫu có "Ca sáng" và "Ca tối").
      rows = [];
      for (const sheetName of wb.SheetNames) {
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        for (const r of data) rows.push({ ...r, __sheet: sheetName });
      }
    } catch {
      return res.status(400).json({ message: 'Không đọc được file. Hãy dùng định dạng .xlsx hoặc .csv' });
    }

    const results = { created: 0, updated: 0, skipped: 0, errors: [] };

    // Bộ phận PHẢI đã tồn tại sẵn — không tự tạo để tránh phòng ban rác do lỗi chính tả.
    const depts = await prisma.department.findMany();
    const deptByName = new Map(depts.map((d) => [normalizeHeader(d.name), d.id]));

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const fullName = pick(row, ['ho va ten', 'ho ten', 'ten', 'fullname', 'name']);
      const email = pick(row, ['email', 'mail']).toLowerCase();
      const code = pick(row, ['ma nv', 'ma nhan vien', 'manv', 'code', 'employeecode']);
      const phone = pick(row, ['so dien thoai', 'sdt', 'dien thoai', 'phone']);
      const deptName = pick(row, ['bo phan', 'phong ban', 'department', 'phong']);

      // Cần ít nhất email hoặc mã + tên.
      if (!email && !code) { results.skipped++; continue; }
      if (!fullName) { results.skipped++; continue; }

      // Bộ phận phải khớp tên có sẵn; không khớp -> báo lỗi dòng đó, KHÔNG tự tạo mới.
      let departmentId = null;
      if (deptName) {
        const key = normalizeHeader(deptName);
        if (deptByName.has(key)) {
          departmentId = deptByName.get(key);
        } else {
          results.errors.push({
            row: i + 2,
            email,
            message: `Bộ phận "${deptName}" chưa tồn tại trong hệ thống. Vào Quản trị > Bộ phận để thêm trước, hoặc sửa lại tên cho khớp.`,
          });
          continue;
        }
      }

      try {
        // Khóa dò trùng: ưu tiên email, fallback employeeCode.
        const existing = email
          ? await prisma.employee.findUnique({ where: { email } })
          : await prisma.employee.findUnique({ where: { employeeCode: code } });

        if (existing) {
          await prisma.employee.update({
            where: { id: existing.id },
            data: {
              fullName,
              phone: phone || existing.phone,
              departmentId: departmentId ?? existing.departmentId,
            },
          });
          results.updated++;
        } else {
          // Dùng index dòng để đảm bảo mã không trùng dù nhiều dòng cùng thiếu mã NV trong 1 lần import.
          const empCode = code || `NV-AUTO-${Date.now().toString().slice(-6)}-${i}`;
          // Mật khẩu mặc định = mã NV (lowercase) để NV đăng nhập lần đầu.
          const passwordHash = await bcrypt.hash(empCode.toLowerCase(), 10);
          await prisma.employee.create({
            data: {
              employeeCode: empCode,
              fullName,
              email: email || null,
              phone: phone || null,
              passwordHash,
              role: 'EMPLOYEE',
              departmentId,
            },
          });
          results.created++;
        }
      } catch (err) {
        results.errors.push({ row: i + 2, email, message: err.message });
      }
    }

    await logAction(req, {
      action: 'EMPLOYEE_IMPORT',
      detail: `Tạo mới ${results.created}, cập nhật ${results.updated}, bỏ qua ${results.skipped}, lỗi ${results.errors.length}`,
    });
    res.json(results);
  })
);

export default router;
