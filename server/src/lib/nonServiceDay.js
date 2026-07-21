// Kiểm tra 1 ngày có phải NGÀY KHÔNG PHỤC VỤ (nghỉ lễ, bảo trì bếp) hay không.
// Ngày không phục vụ: chặn mọi đăng ký/báo lô/lịch định kỳ sinh lô cho ngày đó.
import prisma from './prisma.js';

function toDate(dateOrStr) {
  if (dateOrStr instanceof Date) return new Date(`${dateOrStr.toISOString().slice(0, 10)}T00:00:00.000Z`);
  return new Date(`${String(dateOrStr).slice(0, 10)}T00:00:00.000Z`);
}

export async function isNonServiceDay(dateOrStr) {
  const date = toDate(dateOrStr);
  if (Number.isNaN(date.getTime())) return false;
  const found = await prisma.nonServiceDay.findUnique({ where: { date } });
  return found || null; // trả bản ghi (có reason) hoặc null
}
