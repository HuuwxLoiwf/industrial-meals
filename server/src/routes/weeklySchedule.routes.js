// Lịch đăng ký định kỳ theo tuần: leader đặt 1 lần "thứ mấy trong tuần + ca + số suất",
// hệ thống tự sinh BatchRegistration cho hôm nay nếu khớp lịch (idempotent theo lastGeneratedDate).
// Không có cron scheduler riêng trong server -> tự sinh mỗi khi có người gọi GET /batches*
// hoặc khi service khởi động, bằng cách gọi generateForToday() (xem generateSchedules.js).
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';
import { generateForToday } from '../lib/generateSchedules.js';

const router = Router();

// GET /api/weekly-schedules - danh sách lịch định kỳ (MANAGER chỉ xem của mình, ADMIN xem hết).
router.get(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.employee.role === 'MANAGER') where.createdById = req.employee.id;
    const templates = await prisma.weeklyScheduleTemplate.findMany({
      where,
      include: { mealShift: true, createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(templates);
  })
);

// POST /api/weekly-schedules  body: { mealShiftId, weekdays: [1..7], qtyStandard, qtyAlternative, batchType, note }
router.post(
  '/',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const { mealShiftId, weekdays, note } = req.body;
    const batchType = req.body.batchType === 'OVERTIME_INTERN' ? 'OVERTIME_INTERN' : 'NORMAL';
    const qtyStandard = Math.max(0, parseInt(req.body.qtyStandard, 10) || 0);
    const qtyAlternative = Math.max(0, parseInt(req.body.qtyAlternative, 10) || 0);

    if (!mealShiftId || !Array.isArray(weekdays) || weekdays.length === 0) {
      return res.status(400).json({ message: 'Thiếu ca ăn hoặc danh sách thứ trong tuần' });
    }
    if (weekdays.some((w) => !Number.isInteger(w) || w < 1 || w > 7)) {
      return res.status(400).json({ message: 'Thứ trong tuần không hợp lệ (1=Thứ 2 ... 7=Chủ nhật)' });
    }
    if (qtyStandard + qtyAlternative === 0) {
      return res.status(400).json({ message: 'Số suất phải lớn hơn 0' });
    }

    // ADMIN chọn phòng ban bất kỳ; MANAGER dùng phòng của mình.
    let departmentId, departmentName;
    if (req.employee.role === 'ADMIN') {
      if (!req.body.departmentId) {
        return res.status(400).json({ message: 'Vui lòng chọn phòng ban cho lịch định kỳ.' });
      }
      const dept = await prisma.department.findUnique({ where: { id: req.body.departmentId } });
      if (!dept) return res.status(400).json({ message: 'Phòng ban không tồn tại' });
      departmentId = dept.id;
      departmentName = dept.name;
    } else {
      if (!req.employee.departmentId) {
        return res.status(400).json({ message: 'Tài khoản của bạn chưa được gán bộ phận' });
      }
      departmentId = req.employee.departmentId;
      departmentName = req.employee.department?.name || null;
    }

    const shift = await prisma.mealShift.findUnique({ where: { id: mealShiftId } });
    if (!shift) return res.status(400).json({ message: 'Ca ăn không tồn tại' });
    if (!shift.active) return res.status(400).json({ message: 'Ca ăn này đã ngừng hoạt động' });

    const template = await prisma.weeklyScheduleTemplate.create({
      data: {
        createdById: req.employee.id,
        departmentId,
        departmentName,
        mealShiftId,
        batchType,
        weekdays,
        qtyStandard,
        qtyAlternative,
        note: note ?? null,
      },
      include: { mealShift: true },
    });

    await logAction(req, {
      action: 'WEEKLY_SCHEDULE_CREATE',
      entity: 'WeeklyScheduleTemplate',
      entityId: template.id,
      detail: `${shift.name} - ${qtyStandard + qtyAlternative} suất/ngày`,
    });

    res.status(201).json(template);
  })
);

// PUT /api/weekly-schedules/:id - sửa lịch định kỳ (chỉ người tạo hoặc admin).
router.put(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.weeklyScheduleTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy lịch định kỳ' });
    if (existing.createdById !== req.employee.id && req.employee.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Không thể sửa lịch của người khác' });
    }

    const { weekdays, note, active } = req.body;
    const data = {};
    if (weekdays !== undefined) {
      if (!Array.isArray(weekdays) || weekdays.length === 0 || weekdays.some((w) => !Number.isInteger(w) || w < 1 || w > 7)) {
        return res.status(400).json({ message: 'Thứ trong tuần không hợp lệ' });
      }
      data.weekdays = weekdays;
    }
    if (req.body.qtyStandard !== undefined) data.qtyStandard = Math.max(0, parseInt(req.body.qtyStandard, 10) || 0);
    if (req.body.qtyAlternative !== undefined) data.qtyAlternative = Math.max(0, parseInt(req.body.qtyAlternative, 10) || 0);
    if (note !== undefined) data.note = note;
    if (active !== undefined) data.active = !!active;

    const updated = await prisma.weeklyScheduleTemplate.update({
      where: { id: existing.id },
      data,
      include: { mealShift: true },
    });

    await logAction(req, {
      action: 'WEEKLY_SCHEDULE_UPDATE',
      entity: 'WeeklyScheduleTemplate',
      entityId: updated.id,
      detail: updated.active ? 'Cập nhật' : 'Tạm dừng lịch',
    });

    res.json(updated);
  })
);

// DELETE /api/weekly-schedules/:id
router.delete(
  '/:id',
  requireRole('MANAGER', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.weeklyScheduleTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy lịch định kỳ' });
    if (existing.createdById !== req.employee.id && req.employee.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Không thể xóa lịch của người khác' });
    }
    await prisma.weeklyScheduleTemplate.delete({ where: { id: existing.id } });
    await logAction(req, {
      action: 'WEEKLY_SCHEDULE_DELETE',
      entity: 'WeeklyScheduleTemplate',
      entityId: existing.id,
    });
    res.status(204).end();
  })
);

// POST /api/weekly-schedules/generate-today - kích hoạt thủ công việc sinh lô hôm nay
// (server cũng tự gọi hàm này định kỳ, xem lib/generateSchedules.js).
router.post(
  '/generate-today',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const result = await generateForToday();
    res.json(result);
  })
);

export default router;
