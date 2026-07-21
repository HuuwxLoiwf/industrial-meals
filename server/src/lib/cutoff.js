// Kiểm tra hạn chót đăng ký (cut-off) cho 1 ca vào 1 ngày — theo giờ Việt Nam.
// Trả về { blocked: boolean, message?: string }.
//
// Quy tắc: chỉ áp dụng khi đăng ký cho HÔM NAY (giờ VN). Nếu giờ VN hiện tại đã
// qua cutoffTime của ca thì chặn. Ngày tương lai luôn được phép.
import { todayVNStr, nowVNTimeStr } from './dates.js';

export function checkCutoff(shift, mealDate) {
  if (!shift?.cutoffTime) return { blocked: false };

  const todayStr = todayVNStr();
  const dateStr =
    mealDate instanceof Date ? mealDate.toISOString().slice(0, 10) : String(mealDate).slice(0, 10);

  if (dateStr > todayStr) return { blocked: false };
  if (dateStr < todayStr) return { blocked: true, message: 'Không thể đăng ký cho ngày đã qua' };

  // Hôm nay: so "HH:mm" hiện tại (VN) với cutoff.
  if (nowVNTimeStr() > shift.cutoffTime) {
    return {
      blocked: true,
      message: `Đã quá hạn đăng ký ca này (hạn chót ${shift.cutoffTime}). Vui lòng đăng ký trước hạn.`,
    };
  }
  return { blocked: false };
}
