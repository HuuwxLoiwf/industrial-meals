// Kiểm tra 1 ngày có thuộc kỳ (tháng) đã CHỐT SỔ hay không.
// Kỳ đã chốt: khóa toàn bộ đăng ký/lô của các ngày trong đó để báo cáo tháng
// thành số liệu chính thức, không ai được sửa/xóa/thêm mới nữa.
import prisma from './prisma.js';

// dateOrStr: Date hoặc "YYYY-MM-DD".
export async function isPeriodClosed(dateOrStr) {
  const str = dateOrStr instanceof Date ? dateOrStr.toISOString().slice(0, 10) : String(dateOrStr);
  const month = str.slice(0, 7); // "YYYY-MM"
  const closed = await prisma.closedPeriod.findUnique({ where: { month } });
  return !!closed;
}

export async function assertPeriodOpen(dateOrStr) {
  if (await isPeriodClosed(dateOrStr)) {
    const str = dateOrStr instanceof Date ? dateOrStr.toISOString().slice(0, 10) : String(dateOrStr);
    const err = new Error(`Kỳ ${str.slice(0, 7)} đã được chốt sổ, không thể thêm/sửa/xóa dữ liệu.`);
    err.status = 400;
    throw err;
  }
}
