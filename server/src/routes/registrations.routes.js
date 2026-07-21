// Module 4: Đăng ký suất ăn đơn lẻ — trường hợp đặc biệt (không thuộc lô nào).
// ADMIN đăng ký hộ, chọn đích danh nhân viên. Nhà ăn phát khay trực tiếp,
// không còn khái niệm quét mã/xác nhận nhận suất (đã bỏ MealReceipt).
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { emitEvent, EVENTS } from '../lib/realtime.js';
import { checkCutoff } from '../lib/cutoff.js';
import { logAction } from '../lib/audit.js';
import { isPeriodClosed } from '../lib/closedPeriod.js';
import { isNonServiceDay } from '../lib/nonServiceDay.js';

const router = Router();

function parseMealDate(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET /api/registrations/mine?date=YYYY-MM-DD
// Nhân viên xem đăng ký của chính mình (mặc định hôm nay).
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const where = { employeeId: req.employee.id };
    const date = parseMealDate(req.query.date);
    if (date) where.mealDate = date;

    const registrations = await prisma.mealRegistration.findMany({
      where,
      include: { mealShift: true },
      orderBy: [{ mealDate: 'desc' }, { mealShift: { order: 'asc' } }],
    });
    res.json(registrations);
  })
);

// POST /api/registrations  body: { employeeId, mealShiftId, mealDate, note, mealType }
// Đăng ký 1 ca ăn cho 1 ngày, cho MỘT NHÂN VIÊN CỤ THỂ. CHỈ ADMIN. Idempotent.
router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { employeeId, mealShiftId, mealDate, note, mealType } = req.body;
    const date = parseMealDate(mealDate);
    if (!employeeId || !mealShiftId || !date) {
      return res.status(400).json({ message: 'Thiếu nhân viên, ca ăn hoặc ngày' });
    }
    const type = mealType === 'ALTERNATIVE' ? 'ALTERNATIVE' : 'STANDARD';

    const targetEmployee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, fullName: true } });
    if (!targetEmployee) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });

    const shift = await prisma.mealShift.findUnique({ where: { id: mealShiftId } });
    if (!shift) return res.status(400).json({ message: 'Ca ăn không tồn tại' });
    if (!shift.active) return res.status(400).json({ message: 'Ca ăn này đã ngừng hoạt động' });
    const cutoff = checkCutoff(shift, date);
    if (cutoff.blocked) return res.status(400).json({ message: cutoff.message });
    if (await isPeriodClosed(mealDate)) {
      return res.status(400).json({ message: `Kỳ ${mealDate.slice(0, 7)} đã được chốt sổ, không thể đăng ký thêm.` });
    }
    const nonService = await isNonServiceDay(mealDate);
    if (nonService) {
      return res.status(400).json({ message: `Ngày ${mealDate} là ngày không phục vụ${nonService.reason ? ` (${nonService.reason})` : ''}, không thể đăng ký.` });
    }

    // Mỗi nhân viên chỉ được 1 suất/ngày: nếu đã có suất ở ca KHÁC (chưa hủy) -> chặn.
    const otherActive = await prisma.mealRegistration.findFirst({
      where: {
        employeeId,
        mealDate: date,
        mealShiftId: { not: mealShiftId },
        status: { not: 'CANCELLED' },
      },
      include: { mealShift: true },
    });
    if (otherActive) {
      return res.status(409).json({
        message: `${targetEmployee.fullName} đã đăng ký suất ăn ca "${otherActive.mealShift.name}" cho ngày này. Mỗi ngày chỉ được 1 suất — hãy hủy suất cũ trước.`,
      });
    }

    const registration = await prisma.mealRegistration.upsert({
      where: {
        employeeId_mealShiftId_mealDate: { employeeId, mealShiftId, mealDate: date },
      },
      update: { status: 'APPROVED', note: note ?? null, mealType: type },
      create: {
        employeeId,
        mealShiftId,
        mealDate: date,
        mealType: type,
        status: 'APPROVED',
        note: note ?? null,
        createdById: req.employee.id,
      },
      include: {
        mealShift: true,
        employee: { select: { id: true, fullName: true, employeeCode: true, department: true } },
      },
    });

    await logAction(req, {
      action: 'REGISTRATION_CREATE',
      entity: 'MealRegistration',
      entityId: registration.id,
      detail: `${targetEmployee.fullName} - ${shift.name} - ${mealDate}`,
    });

    emitEvent(EVENTS.REGISTRATION_CREATED, registration);
    res.status(201).json(registration);
  })
);

// POST /api/registrations/batch-days  body: { employeeId, mealShiftId, dates: [], mealType }
// Đăng ký cùng 1 ca cho NHIỀU ngày (vd cả tuần) cho 1 nhân viên. CHỈ ADMIN.
router.post(
  '/batch-days',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { employeeId, mealShiftId, dates = [], mealType } = req.body;
    const type = mealType === 'ALTERNATIVE' ? 'ALTERNATIVE' : 'STANDARD';
    if (!employeeId || !mealShiftId || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ message: 'Thiếu nhân viên, ca ăn hoặc danh sách ngày' });
    }

    const targetEmployee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, fullName: true } });
    if (!targetEmployee) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });

    const shift = await prisma.mealShift.findUnique({ where: { id: mealShiftId } });
    if (!shift) return res.status(400).json({ message: 'Ca ăn không tồn tại' });

    const result = { created: 0, skipped: 0, errors: [] };

    for (const dStr of dates) {
      const date = parseMealDate(dStr);
      if (!date) {
        result.skipped++;
        continue;
      }
      const cutoff = checkCutoff(shift, date);
      if (cutoff.blocked) {
        result.errors.push({ date: dStr, message: cutoff.message });
        continue;
      }
      if (await isPeriodClosed(date)) {
        result.errors.push({ date: dStr, message: 'Kỳ này đã được chốt sổ' });
        continue;
      }
      if (await isNonServiceDay(date)) {
        result.errors.push({ date: dStr, message: 'Ngày không phục vụ' });
        continue;
      }
      const otherActive = await prisma.mealRegistration.findFirst({
        where: {
          employeeId,
          mealDate: date,
          mealShiftId: { not: mealShiftId },
          status: { not: 'CANCELLED' },
        },
      });
      if (otherActive) {
        result.errors.push({ date: dStr, message: 'Đã có suất ca khác' });
        continue;
      }
      await prisma.mealRegistration.upsert({
        where: { employeeId_mealShiftId_mealDate: { employeeId, mealShiftId, mealDate: date } },
        update: { status: 'APPROVED', mealType: type },
        create: {
          employeeId,
          mealShiftId,
          mealDate: date,
          mealType: type,
          status: 'APPROVED',
          createdById: req.employee.id,
        },
      });
      result.created++;
    }

    await logAction(req, {
      action: 'REGISTRATION_CREATE_BATCH_DAYS',
      entity: 'MealRegistration',
      detail: `${targetEmployee.fullName} - ${shift.name} - ${result.created} ngày`,
    });

    emitEvent(EVENTS.REGISTRATION_CREATED, { multi: true });
    res.status(201).json(result);
  })
);

// PATCH /api/registrations/:id/cancel - hủy đăng ký đơn lẻ. CHỈ ADMIN.
router.patch(
  '/:id/cancel',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.mealRegistration.findUnique({
      where: { id: req.params.id },
      include: { employee: { select: { fullName: true } }, mealShift: true },
    });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy đăng ký' });
    if (await isPeriodClosed(existing.mealDate)) {
      return res.status(400).json({ message: 'Kỳ này đã được chốt sổ, không thể hủy đăng ký.' });
    }

    const registration = await prisma.mealRegistration.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
      include: { mealShift: true },
    });

    await logAction(req, {
      action: 'REGISTRATION_CANCEL',
      entity: 'MealRegistration',
      entityId: registration.id,
      detail: `${existing.employee.fullName} - ${existing.mealShift.name}`,
    });

    emitEvent(EVENTS.REGISTRATION_UPDATED, registration);
    res.json(registration);
  })
);

// GET /api/registrations?date=&shiftId=&status=&departmentId=
// MANAGER/ADMIN/CANTEEN xem danh sách đăng ký đơn lẻ (kiểm tra/đối chiếu).
router.get(
  '/',
  requireRole('MANAGER', 'ADMIN', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const { shiftId, status, departmentId } = req.query;
    const date = parseMealDate(req.query.date);

    const where = {};
    if (date) where.mealDate = date;
    if (shiftId) where.mealShiftId = shiftId;
    if (status) where.status = status;

    // MANAGER bị giới hạn theo bộ phận của mình.
    const empFilter = {};
    if (req.employee.role === 'MANAGER') {
      empFilter.departmentId = req.employee.departmentId;
    } else if (departmentId) {
      empFilter.departmentId = departmentId;
    }
    if (Object.keys(empFilter).length) where.employee = empFilter;

    const registrations = await prisma.mealRegistration.findMany({
      where,
      include: {
        mealShift: true,
        employee: { select: { id: true, fullName: true, employeeCode: true, department: true } },
      },
      orderBy: [{ employee: { fullName: 'asc' } }],
    });
    res.json(registrations);
  })
);

export default router;
