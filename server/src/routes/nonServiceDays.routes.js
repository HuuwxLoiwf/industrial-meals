// Ngày không phục vụ (nghỉ lễ, bảo trì bếp): admin đánh dấu, hệ thống chặn
// đăng ký/báo lô cho các ngày đó. Ai cũng đọc được (để client biết ngày nào nghỉ).
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';

const router = Router();

function parseDate(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET /api/non-service-days?from=YYYY-MM-DD&to=YYYY-MM-DD  (mặc định: tất cả từ hôm nay trở đi)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = {};
    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = from;
      if (to) where.date.lte = to;
    }
    const days = await prisma.nonServiceDay.findMany({ where, orderBy: { date: 'asc' } });
    res.json(days.map((d) => ({ ...d, date: d.date.toISOString().slice(0, 10) })));
  })
);

// POST /api/non-service-days  body: { date: "YYYY-MM-DD", reason }  — ADMIN.
router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const date = parseDate(req.body.date);
    if (!date) return res.status(400).json({ message: 'Ngày không hợp lệ' });
    const existing = await prisma.nonServiceDay.findUnique({ where: { date } });
    if (existing) return res.status(409).json({ message: 'Ngày này đã được đánh dấu nghỉ' });

    const day = await prisma.nonServiceDay.create({
      data: { date, reason: req.body.reason || null, createdById: req.employee.id },
    });
    await logAction(req, { action: 'NON_SERVICE_DAY_CREATE', entity: 'NonServiceDay', entityId: day.id, detail: `${req.body.date} - ${req.body.reason || ''}` });
    res.status(201).json({ ...day, date: day.date.toISOString().slice(0, 10) });
  })
);

// DELETE /api/non-service-days/:date  — ADMIN mở lại ngày phục vụ bình thường.
router.delete(
  '/:date',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const date = parseDate(req.params.date);
    if (!date) return res.status(400).json({ message: 'Ngày không hợp lệ' });
    const existing = await prisma.nonServiceDay.findUnique({ where: { date } });
    if (!existing) return res.status(404).json({ message: 'Ngày này chưa được đánh dấu nghỉ' });
    await prisma.nonServiceDay.delete({ where: { date } });
    await logAction(req, { action: 'NON_SERVICE_DAY_DELETE', entity: 'NonServiceDay', entityId: existing.id, detail: req.params.date });
    res.json({ message: 'Đã mở lại ngày phục vụ bình thường' });
  })
);

export default router;
