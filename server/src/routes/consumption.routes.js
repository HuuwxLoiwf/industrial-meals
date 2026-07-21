// Thống kê lãng phí / tỷ lệ ăn: nhà ăn nhập SỐ SUẤT THỰC TẾ phát ra cuối mỗi ca,
// hệ thống so với số đã báo -> tính lãng phí (báo thừa) và tỷ lệ ăn thực tế.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';
import { todayVNStr, monthVNStr, parseMealDate } from '../lib/dates.js';

const router = Router();

// Tổng số suất ĐÃ BÁO cho 1 ngày, gộp theo ca (lô + đăng ký cá nhân).
async function reportedByShift(date) {
  const [batches, regs] = await Promise.all([
    prisma.batchRegistration.findMany({ where: { mealDate: date }, select: { mealShiftId: true, qtyStandard: true, qtyAlternative: true } }),
    prisma.mealRegistration.findMany({ where: { mealDate: date, status: { not: 'CANCELLED' } }, select: { mealShiftId: true } }),
  ]);
  const map = {};
  for (const b of batches) map[b.mealShiftId] = (map[b.mealShiftId] || 0) + b.qtyStandard + b.qtyAlternative;
  for (const r of regs) map[r.mealShiftId] = (map[r.mealShiftId] || 0) + 1;
  return map;
}

// GET /api/consumption?date=YYYY-MM-DD — bảng theo ca: số báo, số thực ăn, lãng phí, tỷ lệ.
router.get(
  '/',
  requireRole('CANTEEN', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const dateStr = req.query.date || todayVNStr();
    const date = parseMealDate(dateStr);

    const [shifts, consumptions, reported] = await Promise.all([
      prisma.mealShift.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
      prisma.mealConsumption.findMany({ where: { mealDate: date } }),
      reportedByShift(date),
    ]);
    const consBy = Object.fromEntries(consumptions.map((c) => [c.mealShiftId, c]));

    const rows = shifts.map((s) => {
      const reportedQty = reported[s.id] || 0;
      const served = consBy[s.id]?.actualServed ?? null;
      const waste = served != null ? Math.max(0, reportedQty - served) : null;
      const rate = served != null && reportedQty > 0 ? Math.round((served / reportedQty) * 100) : null;
      return {
        shiftId: s.id,
        shiftName: s.name,
        reported: reportedQty,
        served,
        waste,
        rate, // % số thực ăn / số báo
        note: consBy[s.id]?.note || null,
      };
    });

    const totalReported = rows.reduce((s, r) => s + r.reported, 0);
    const totalServed = rows.reduce((s, r) => s + (r.served || 0), 0);
    const totalWaste = rows.reduce((s, r) => s + (r.waste || 0), 0);

    res.json({
      date: dateStr,
      rows,
      totals: {
        reported: totalReported,
        served: totalServed,
        waste: totalWaste,
        rate: totalReported > 0 ? Math.round((totalServed / totalReported) * 100) : null,
      },
    });
  })
);

// PUT /api/consumption  body: { date, mealShiftId, actualServed, note } — nhà ăn nhập số thực ăn.
router.put(
  '/',
  requireRole('CANTEEN', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const date = parseMealDate(req.body.date);
    const { mealShiftId } = req.body;
    if (!date || !mealShiftId) return res.status(400).json({ message: 'Thiếu ngày hoặc ca ăn' });
    const actualServed = Math.max(0, parseInt(req.body.actualServed, 10) || 0);

    const shift = await prisma.mealShift.findUnique({ where: { id: mealShiftId } });
    if (!shift) return res.status(400).json({ message: 'Ca ăn không tồn tại' });

    const record = await prisma.mealConsumption.upsert({
      where: { mealDate_mealShiftId: { mealDate: date, mealShiftId } },
      update: { actualServed, note: req.body.note ?? null, recordedById: req.employee.id },
      create: { mealDate: date, mealShiftId, actualServed, note: req.body.note ?? null, recordedById: req.employee.id },
    });
    await logAction(req, { action: 'CONSUMPTION_RECORD', entity: 'MealConsumption', entityId: record.id, detail: `${shift.name}: ${actualServed} suất thực ăn` });
    res.json(record);
  })
);

// GET /api/consumption/monthly?month=YYYY-MM — xu hướng lãng phí theo ngày trong tháng.
router.get(
  '/monthly',
  requireRole('CANTEEN', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const month = req.query.month || monthVNStr();
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const [batches, regs, consumptions] = await Promise.all([
      prisma.batchRegistration.findMany({ where: { mealDate: { gte: start, lt: end } }, select: { mealDate: true, qtyStandard: true, qtyAlternative: true } }),
      prisma.mealRegistration.findMany({ where: { mealDate: { gte: start, lt: end }, status: { not: 'CANCELLED' } }, select: { mealDate: true } }),
      prisma.mealConsumption.findMany({ where: { mealDate: { gte: start, lt: end } }, select: { mealDate: true, actualServed: true } }),
    ]);

    const byDay = {};
    const ensure = (d) => (byDay[d] ??= { date: d, reported: 0, served: 0 });
    for (const b of batches) ensure(b.mealDate.toISOString().slice(0, 10)).reported += b.qtyStandard + b.qtyAlternative;
    for (const r of regs) ensure(r.mealDate.toISOString().slice(0, 10)).reported += 1;
    for (const c of consumptions) ensure(c.mealDate.toISOString().slice(0, 10)).served += c.actualServed;

    const days = Object.values(byDay)
      .map((d) => ({ ...d, waste: Math.max(0, d.reported - d.served), rate: d.reported > 0 && d.served > 0 ? Math.round((d.served / d.reported) * 100) : null }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalReported = days.reduce((s, d) => s + d.reported, 0);
    const totalServed = days.reduce((s, d) => s + d.served, 0);
    res.json({
      month,
      days,
      totals: { reported: totalReported, served: totalServed, waste: Math.max(0, totalReported - totalServed), rate: totalReported > 0 && totalServed > 0 ? Math.round((totalServed / totalReported) * 100) : null },
    });
  })
);

export default router;
