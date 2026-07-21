// Tiện ích JWT thuần (thay Clerk). Ký & xác thực token bằng secret trong .env.
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'umc-dev-secret-change-me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Tạo token chứa id nhân viên (sub) + role.
export function signToken(employee) {
  return jwt.sign(
    { sub: employee.id, role: employee.role, email: employee.email },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

// Xác thực & giải mã token. Ném lỗi nếu không hợp lệ.
export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}
