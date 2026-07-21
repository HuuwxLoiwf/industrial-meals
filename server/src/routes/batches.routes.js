// Đăng ký theo lô: leader/quản lý ca báo TỔNG SỐ suất cho 1 ca để nhà ăn chuẩn bị.
// Không quét mã, không xác nhận phát từng lô — nhà ăn phát khay trực tiếp theo
// số lượng đã đăng ký, chỉ cần xem bảng tổng hợp để biết nấu bao nhiêu.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { emitEvent, EVENTS } from '../lib/realtime.js';
import { checkCutoff } from '../lib/cutoff.js';
import { todayVNStr } from '../lib/dates.js';
import { logAction } from '../lib/audit.js';
import { isPeriodClosed } from '../lib/closedPeriod.js';
import { isNonServiceDay } from '../lib/nonServiceDay.js';

const router = Router();

function parseMealDate(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET /api/batches/mine?date=YYYY-MM-DD - các lô do người dùng hiện tại tạo.
router.get(
  '/mine',
  requireRole('MANAGER', 'ADMIN', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const where = { createdById: req.employee.id };
    const date = parseMealDate(req.query.date);
    if (date) where.mealDate = date;
    const batches = await prisma.batchRegistration.findMany({
      where,
      include: { mealShift: true },
      orderBy: [{ mealDate: 'desc' }, { mealShift: { order: 'asc' } }],
    });
    res.json(batches);
  })
);

// GET /api/batches?date=YYYY-MM-DD - tất cả lô (nhà ăn/admin xem để chuẩn bị).
router.get(
  '/',
  requireRole('MANAGER', 'ADMIN', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const where = {};
    const date = parseMealDate(req.query.date);
    if (date) where.mealDate = date;
    if (req.employee.role === 'MANAGER') where.departmentId = req.employee.departmentId;
    const batches = await prisma.batchRegistration.findMany({
      where,
      include: { mealShift: true, createdBy: { select: { fullName: true } } },
      orderBy: [{ mealShift: { order: 'asc' } }],
    });
    res.json(batches);
  })
);

// GET /api/batches/my-department?date=YYYY-MM-DD
// Cho MỌI nhân viên xem lô suất ăn của PHÒNG BAN MÌNH trong ngày (để biết
// phòng được báo bao nhiêu suất). EMPLOYEE dùng ở trang "Suất ăn phòng tôi".
router.get(
  '/my-department',
  asyncHandler(async (req, res) => {
    const date = parseMealDate(req.query.date) || parseMealDate(todayVNStr());
    if (!req.employee.departmentId) {
      return res.json({ date: req.query.date || todayVNStr(), department: null, batches: [], total: 0 });
    }
    const batches = await prisma.batchRegistration.findMany({
      where: { departmentId: req.employee.departmentId, mealDate: date },
      include: { mealShift: true, createdBy: { select: { fullName: true } } },
      orderBy: [{ mealShift: { order: 'asc' } }],
    });
    const total = batches.reduce((s, b) => s + b.qtyStandard + b.qtyAlternative, 0);
    res.json({
      date: req.query.date || todayVNStr(),
      department: req.employee.department?.name || null,
      batches,
      total,
    });
  })
);

// GET /api/batches/prep?date=YYYY-MM-DD
// Bảng CHUẨN BỊ SUẤT ĂN cho nhà ăn: tổng số suất theo ca, tách riêng thường/tăng ca TTS.
// Chỉ xem, không có thao tác xác nhận — đúng quy trình phát khay trực tiếp không quét mã.
router.get(
  '/prep',
  requireRole('MANAGER', 'ADMIN', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const date = parseMealDate(req.query.date) || parseMealDate(todayVNStr());

    const [batches, shifts] = await Promise.all([
      prisma.batchRegistration.findMany({
        where: { mealDate: date },
        include: { mealShift: true },
      }),
      prisma.mealShift.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
    ]);

    const rows = shifts.map((s) => {
      const forShift = batches.filter((b) => b.mealShiftId === s.id);
      const normal = forShift.filter((b) => b.batchType === 'NORMAL');
      const overtime = forShift.filter((b) => b.batchType === 'OVERTIME_INTERN');
      const sum = (list) => ({
        standard: list.reduce((s, b) => s + b.qtyStandard, 0),
        alternative: list.reduce((s, b) => s + b.qtyAlternative, 0),
      });
      const n = sum(normal);
      const o = sum(overtime);
      return {
        shiftId: s.id,
        shiftName: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        normal: n,
        overtimeIntern: o,
        total: n.standard + n.alternative + o.standard + o.alternative,
      };
    });

    res.json({
      date: req.query.date || todayVNStr(),
      rows,
      grandTotal: rows.reduce((s, r) => s + r.total, 0),
    });
  })
);

// POST /api/batches  body: { mealShiftId, mealDate, qtyStandard, qtyAlternative, note, batchType }
// batchType: 'NORMAL' (mặc định) hoặc 'OVERTIME_INTERN' (báo tăng ca cho thực tập sinh).
router.post(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { mealShiftId, mealDate, note } = req.body;
    const batchType = req.body.batchType === 'OVERTIME_INTERN' ? 'OVERTIME_INTERN' : 'NORMAL';
    const qtyStandard = Math.max(0, parseInt(req.body.qtyStandard, 10) || 0);
    const qtyAlternative = Math.max(0, parseInt(req.body.qtyAlternative, 10) || 0);
    const date = parseMealDate(mealDate);

    if (!mealShiftId || !date) {
      return res.status(400).json({ message: 'Thiếu ca ăn hoặc ngày' });
    }
    if (qtyStandard + qtyAlternative === 0) {
      return res.status(400).json({ message: 'Số suất phải lớn hơn 0' });
    }
    if (date < parseMealDate(todayVNStr())) {
      return res.status(400).json({ message: 'Không thể đăng ký cho ngày trong quá khứ' });
    }
    if (await isPeriodClosed(mealDate)) {
      return res.status(400).json({ message: `Kỳ ${mealDate.slice(0, 7)} đã được chốt sổ, không thể đăng ký thêm.` });
    }
    const nonService = await isNonServiceDay(mealDate);
    if (nonService) {
      return res.status(400).json({ message: `Ngày ${mealDate} là ngày không phục vụ${nonService.reason ? ` (${nonService.reason})` : ''}, không thể báo suất ăn.` });
    }

    // Xác định phòng ban của lô:
    //  - ADMIN (full quyền): chọn đích danh 1 phòng ban bất kỳ qua body.departmentId.
    //  - MANAGER/leader: luôn gắn phòng ban của chính mình (không được báo hộ phòng khác).
    let departmentId, departmentName;
    if (req.employee.role === 'ADMIN') {
      if (!req.body.departmentId) {
        return res.status(400).json({ message: 'Vui lòng chọn phòng ban cho lô suất ăn.' });
      }
      const dept = await prisma.department.findUnique({ where: { id: req.body.departmentId } });
      if (!dept) return res.status(400).json({ message: 'Phòng ban không tồn tại' });
      departmentId = dept.id;
      departmentName = dept.name;
    } else {
      if (!req.employee.departmentId) {
        return res.status(400).json({
          message: 'Tài khoản của bạn chưa được gán bộ phận. Vui lòng liên hệ quản trị viên gán bộ phận trước khi đăng ký lô.',
        });
      }
      departmentId = req.employee.departmentId;
      departmentName = req.employee.department?.name || null;
    }

    const shift = await prisma.mealShift.findUnique({ where: { id: mealShiftId } });
    if (!shift) return res.status(400).json({ message: 'Ca ăn không tồn tại' });
    if (!shift.active) return res.status(400).json({ message: 'Ca ăn này đã ngừng hoạt động' });
    const cutoff = checkCutoff(shift, date);
    if (cutoff.blocked) return res.status(400).json({ message: cutoff.message });

    // Chặn báo trùng: cùng phòng ban + ca + ngày + loại lô -> nên sửa lô cũ thay vì tạo mới.
    const dup = await prisma.batchRegistration.findFirst({
      where: {
        departmentId,
        mealShiftId,
        mealDate: date,
        batchType,
      },
    });
    if (dup) {
      return res.status(409).json({
        message: `Phòng ban của bạn đã báo suất cho ca này (loại ${batchType === 'OVERTIME_INTERN' ? 'tăng ca TTS' : 'thường'}) vào ngày này. Hãy sửa lô đã có thay vì tạo lô mới.`,
        existingBatchId: dup.id,
      });
    }

    // Giới hạn công suất bếp: tổng số suất đã báo (mọi phòng ban) cho ca này không vượt maxCapacity.
    if (shift.maxCapacity != null) {
      const existing = await prisma.batchRegistration.findMany({
        where: { mealShiftId, mealDate: date },
        select: { qtyStandard: true, qtyAlternative: true },
      });
      const already = existing.reduce((s, b) => s + b.qtyStandard + b.qtyAlternative, 0);
      const requested = qtyStandard + qtyAlternative;
      if (already + requested > shift.maxCapacity) {
        return res.status(400).json({
          message: `Vượt công suất bếp cho ca này (tối đa ${shift.maxCapacity} suất, đã báo ${already}, còn nhận được ${Math.max(0, shift.maxCapacity - already)}).`,
        });
      }
    }

    const batch = await prisma.batchRegistration.create({
      data: {
        batchType,
        createdById: req.employee.id,
        departmentId,
        departmentName,
        mealShiftId,
        mealDate: date,
        qtyStandard,
        qtyAlternative,
        note: note ?? null,
      },
      include: { mealShift: true },
    });

    await logAction(req, {
      action: 'BATCH_CREATE',
      entity: 'BatchRegistration',
      entityId: batch.id,
      detail: `${shift.name} - ${qtyStandard + qtyAlternative} suất (${batchType})`,
    });

    emitEvent(EVENTS.REGISTRATION_CREATED, { batch: true, id: batch.id });
    res.status(201).json(batch);
  })
);

// PUT /api/batches/:id - sửa số suất (chỉ người tạo hoặc admin).
// Áp dụng cùng ràng buộc như khi tạo mới: hạn chót đăng ký + công suất bếp.
router.put(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const batch = await prisma.batchRegistration.findUnique({
      where: { id: req.params.id },
      include: { mealShift: true },
    });
    if (!batch) return res.status(404).json({ message: 'Không tìm thấy lô đăng ký' });
    if (batch.createdById !== req.employee.id && req.employee.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Không thể sửa lô của người khác' });
    }

    const cutoff = checkCutoff(batch.mealShift, batch.mealDate);
    if (cutoff.blocked) return res.status(400).json({ message: cutoff.message });
    if (await isPeriodClosed(batch.mealDate)) {
      return res.status(400).json({ message: 'Kỳ này đã được chốt sổ, không thể sửa lô.' });
    }

    const qtyStandard = Math.max(0, parseInt(req.body.qtyStandard, 10) || 0);
    const qtyAlternative = Math.max(0, parseInt(req.body.qtyAlternative, 10) || 0);
    if (qtyStandard + qtyAlternative === 0) {
      return res.status(400).json({ message: 'Số suất phải lớn hơn 0. Nếu muốn bỏ, hãy xóa lô.' });
    }

    if (batch.mealShift.maxCapacity != null) {
      const others = await prisma.batchRegistration.findMany({
        where: { mealShiftId: batch.mealShiftId, mealDate: batch.mealDate, id: { not: batch.id } },
        select: { qtyStandard: true, qtyAlternative: true },
      });
      const otherTotal = others.reduce((s, b) => s + b.qtyStandard + b.qtyAlternative, 0);
      const requested = qtyStandard + qtyAlternative;
      if (otherTotal + requested > batch.mealShift.maxCapacity) {
        return res.status(400).json({
          message: `Vượt công suất bếp cho ca này (tối đa ${batch.mealShift.maxCapacity} suất, các lô khác đã chiếm ${otherTotal}).`,
        });
      }
    }

    const updated = await prisma.batchRegistration.update({
      where: { id: batch.id },
      data: { qtyStandard, qtyAlternative, note: req.body.note ?? batch.note },
      include: { mealShift: true },
    });

    await logAction(req, {
      action: 'BATCH_UPDATE',
      entity: 'BatchRegistration',
      entityId: updated.id,
      detail: `${updated.mealShift.name}: ${batch.qtyStandard + batch.qtyAlternative} -> ${qtyStandard + qtyAlternative} suất`,
    });

    emitEvent(EVENTS.REGISTRATION_UPDATED, { batch: true, id: updated.id });
    res.json(updated);
  })
);

// DELETE /api/batches/:id
router.delete(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const batch = await prisma.batchRegistration.findUnique({
      where: { id: req.params.id },
      include: { mealShift: true },
    });
    if (!batch) return res.status(404).json({ message: 'Không tìm thấy lô' });
    if (batch.createdById !== req.employee.id && req.employee.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Không thể xóa lô của người khác' });
    }
    if (await isPeriodClosed(batch.mealDate)) {
      return res.status(400).json({ message: 'Kỳ này đã được chốt sổ, không thể xóa lô.' });
    }
    await prisma.batchRegistration.delete({ where: { id: batch.id } });
    await logAction(req, {
      action: 'BATCH_DELETE',
      entity: 'BatchRegistration',
      entityId: batch.id,
      detail: `${batch.mealShift.name} - ${batch.qtyStandard + batch.qtyAlternative} suất`,
    });
    emitEvent(EVENTS.REGISTRATION_UPDATED, { batch: true, id: batch.id, deleted: true });
    res.status(204).end();
  })
);

export default router;
