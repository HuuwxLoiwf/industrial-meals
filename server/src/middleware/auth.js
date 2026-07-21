// Middleware xác thực & phân quyền — JWT thuần (không còn Clerk).
//
// Luồng:
//  1. requireAuth: verify Bearer token -> req.employeeId.
//  2. attachEmployee: nạp bản ghi Employee từ DB -> req.employee.
//  3. requireRole(...roles): kiểm tra role.
import { verifyToken } from '../lib/jwt.js';
import prisma from '../lib/prisma.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    req.employeeId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ' });
  }
}

// Nạp thông tin Employee từ DB vào req. Không tự tạo mới (whitelist do admin quản lý).
export async function attachEmployee(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.employeeId },
      include: { department: true },
    });
    if (!employee) {
      return res.status(403).json({ message: 'Tài khoản không tồn tại trong hệ thống.' });
    }
    if (employee.status === 'INACTIVE') {
      return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa.' });
    }
    req.employee = employee;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.employee) {
      return res.status(401).json({ message: 'Thiếu thông tin nhân viên' });
    }
    if (!roles.includes(req.employee.role)) {
      return res
        .status(403)
        .json({ message: 'Bạn không có quyền thực hiện thao tác này' });
    }
    next();
  };
}
