// Tự sinh BatchRegistration hôm nay từ các WeeklyScheduleTemplate đang active.
// Không dùng cron scheduler ngoài (không có dependency node-cron) — thay vào đó
// server.js gọi hàm này định kỳ bằng setInterval, và route generate-today gọi
// thủ công. Idempotent nhờ lastGeneratedDate + kiểm tra trùng lô đã tồn tại.
import prisma from './prisma.js';
import { todayVNStr } from './dates.js';
import { checkCutoff } from './cutoff.js';
import { emitEvent, EVENTS } from './realtime.js';
import { isPeriodClosed } from './closedPeriod.js';
import { isNonServiceDay } from './nonServiceDay.js';

// Thứ trong tuần kiểu ISO: 1=Thứ 2 ... 7=Chủ nhật (khớp với getUTCDay() đã quy đổi).
function isoWeekdayVN() {
  const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const day = vnNow.getUTCDay(); // 0=CN ... 6=Thứ 7
  return day === 0 ? 7 : day;
}

export async function generateForToday() {
  const todayStr = todayVNStr();
  const today = new Date(`${todayStr}T00:00:00.000Z`);
  const weekday = isoWeekdayVN();
  const result = { date: todayStr, created: 0, skipped: 0 };

  if (await isPeriodClosed(today)) return result;
  if (await isNonServiceDay(today)) return result; // ngày nghỉ lễ -> không sinh lô

  const templates = await prisma.weeklyScheduleTemplate.findMany({
    where: { active: true, weekdays: { has: weekday } },
    include: { mealShift: true },
  });

  for (const tpl of templates) {
    // Đã sinh cho hôm nay rồi -> bỏ qua (idempotent theo ngày, không phụ thuộc giờ chạy job).
    if (tpl.lastGeneratedDate && tpl.lastGeneratedDate.toISOString().slice(0, 10) === todayStr) {
      result.skipped++;
      continue;
    }
    if (!tpl.mealShift.active) {
      result.skipped++;
      continue;
    }
    const cutoff = checkCutoff(tpl.mealShift, today);
    if (cutoff.blocked) {
      result.skipped++;
      continue;
    }
    if (!tpl.departmentId) {
      result.skipped++;
      continue;
    }

    // Nếu phòng ban đã có lô cùng ca+ngày+loại (báo thủ công) -> không tạo trùng, chỉ đánh dấu đã xử lý.
    const dup = await prisma.batchRegistration.findFirst({
      where: {
        departmentId: tpl.departmentId,
        mealShiftId: tpl.mealShiftId,
        mealDate: today,
        batchType: tpl.batchType,
      },
    });
    if (!dup) {
      await prisma.batchRegistration.create({
        data: {
          batchType: tpl.batchType,
          createdById: tpl.createdById,
          departmentId: tpl.departmentId,
          departmentName: tpl.departmentName,
          mealShiftId: tpl.mealShiftId,
          mealDate: today,
          qtyStandard: tpl.qtyStandard,
          qtyAlternative: tpl.qtyAlternative,
          note: tpl.note ? `${tpl.note} (tự động theo lịch định kỳ)` : 'Tự động theo lịch định kỳ',
        },
      });
      result.created++;
    }

    await prisma.weeklyScheduleTemplate.update({
      where: { id: tpl.id },
      data: { lastGeneratedDate: today },
    });
  }

  if (result.created > 0) {
    emitEvent(EVENTS.REGISTRATION_CREATED, { batch: true, auto: true });
  }
  return result;
}
