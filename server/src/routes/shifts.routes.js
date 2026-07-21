// Module 3: Quản lý ca ăn (CRUD). Chỉ ADMIN sửa/xóa.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';

const router = Router();

// Kiểm tra chuỗi giờ đúng định dạng "HH:mm" (00:00 - 23:59).
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function isValidTime(t) {
  return typeof t === 'string' && TIME_RE.test(t);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const shifts = await prisma.mealShift.findMany({
      orderBy: { order: 'asc' },
    });
    res.json(shifts);
  })
);

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { name, startTime, endTime, order, period, durationMin, cutoffTime, maxCapacity } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ message: 'Thiếu thông tin ca ăn' });
    }
    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ message: 'Giờ bắt đầu/kết thúc phải đúng định dạng HH:mm' });
    }
    if (cutoffTime && !isValidTime(cutoffTime)) {
      return res.status(400).json({ message: 'Hạn chót đăng ký phải đúng định dạng HH:mm' });
    }
    if (startTime === endTime) {
      return res.status(400).json({ message: 'Giờ bắt đầu và kết thúc không được trùng nhau' });
    }
    if (maxCapacity != null && maxCapacity !== '' && Number(maxCapacity) < 0) {
      return res.status(400).json({ message: 'Công suất bếp không được âm' });
    }
    const shift = await prisma.mealShift.create({
      data: {
        name,
        startTime,
        endTime,
        order: order ?? 0,
        period: period === 'NIGHT' ? 'NIGHT' : 'DAY',
        durationMin: Number(durationMin) || (period === 'NIGHT' ? 45 : 40),
        cutoffTime: cutoffTime || null,
        maxCapacity: maxCapacity ? Number(maxCapacity) : null,
      },
    });
    await logAction(req, { action: 'SHIFT_CREATE', entity: 'MealShift', entityId: shift.id, detail: shift.name });
    res.status(201).json(shift);
  })
);

router.put(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { name, startTime, endTime, order, active, period, durationMin, cutoffTime, maxCapacity } = req.body;
    if (startTime && !isValidTime(startTime)) {
      return res.status(400).json({ message: 'Giờ bắt đầu phải đúng định dạng HH:mm' });
    }
    if (endTime && !isValidTime(endTime)) {
      return res.status(400).json({ message: 'Giờ kết thúc phải đúng định dạng HH:mm' });
    }
    if (cutoffTime && !isValidTime(cutoffTime)) {
      return res.status(400).json({ message: 'Hạn chót đăng ký phải đúng định dạng HH:mm' });
    }
    if (startTime && endTime && startTime === endTime) {
      return res.status(400).json({ message: 'Giờ bắt đầu và kết thúc không được trùng nhau' });
    }
    if (maxCapacity != null && maxCapacity !== '' && Number(maxCapacity) < 0) {
      return res.status(400).json({ message: 'Công suất bếp không được âm' });
    }
    const data = { name, startTime, endTime, order, active };
    if (period !== undefined) data.period = period === 'NIGHT' ? 'NIGHT' : 'DAY';
    if (durationMin !== undefined) data.durationMin = Number(durationMin) || 40;
    if (cutoffTime !== undefined) data.cutoffTime = cutoffTime || null;
    if (maxCapacity !== undefined) data.maxCapacity = maxCapacity ? Number(maxCapacity) : null;
    const shift = await prisma.mealShift.update({
      where: { id: req.params.id },
      data,
    });
    await logAction(req, { action: 'SHIFT_UPDATE', entity: 'MealShift', entityId: shift.id, detail: shift.name });
    res.json(shift);
  })
);

// DELETE /api/shifts/:id — chặn nếu ca còn đăng ký/lô liên quan (xóa cứng sẽ
// CASCADE mất lịch sử báo cáo các tháng trước). Cần ?force=1 để xóa kèm dữ liệu
// (chỉ dùng khi chắc chắn, ví dụ ca tạo nhầm chưa có ai đăng ký thật).
router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const shift = await prisma.mealShift.findUnique({ where: { id: req.params.id } });
    if (!shift) return res.status(404).json({ message: 'Không tìm thấy ca ăn' });

    const [regCount, batchCount] = await Promise.all([
      prisma.mealRegistration.count({ where: { mealShiftId: shift.id } }),
      prisma.batchRegistration.count({ where: { mealShiftId: shift.id } }),
    ]);
    const totalLinked = regCount + batchCount;

    if (totalLinked > 0 && req.query.force !== '1') {
      return res.status(409).json({
        message: `Ca "${shift.name}" đang có ${regCount} đăng ký đơn lẻ và ${batchCount} lô đăng ký. Xóa sẽ MẤT VĨNH VIỄN lịch sử này khỏi báo cáo. Nếu chắc chắn, hãy xác nhận xóa kèm dữ liệu.`,
        linkedRegistrations: regCount,
        linkedBatches: batchCount,
        requiresForce: true,
      });
    }

    await prisma.mealShift.delete({ where: { id: shift.id } });
    await logAction(req, {
      action: 'SHIFT_DELETE',
      entity: 'MealShift',
      entityId: shift.id,
      detail: `${shift.name}${totalLinked > 0 ? ` (kèm ${totalLinked} bản ghi liên quan)` : ''}`,
    });
    res.status(204).end();
  })
);

export default router;
