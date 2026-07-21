// Tiện ích ngày giờ theo múi giờ Việt Nam (UTC+7, không có DST).
//
// Lý do: new Date().toISOString() trả giờ UTC — từ 00:00 đến 07:00 sáng VN,
// chuỗi ngày UTC vẫn là NGÀY HÔM QUA -> sai cut-off, sai "hôm nay" cho ca đêm.

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// "YYYY-MM-DD" của hôm nay theo giờ VN.
export function todayVNStr() {
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

// "YYYY-MM" của tháng hiện tại theo giờ VN.
export function monthVNStr() {
  return todayVNStr().slice(0, 7);
}

// "HH:mm" hiện tại theo giờ VN (so sánh chuỗi được vì cùng định dạng 24h).
export function nowVNTimeStr() {
  return new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(11, 16);
}

// Chuẩn hóa "YYYY-MM-DD" về Date UTC midnight (khớp cột @db.Date của Prisma).
export function parseMealDate(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
