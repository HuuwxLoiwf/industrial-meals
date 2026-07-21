// Chốt sổ tháng: khóa toàn bộ đăng ký/lô/thực đơn của các ngày trong tháng đã chốt
// để số liệu quyết toán với kế toán không bị sửa đổi sau khi đã báo cáo. CHỈ ADMIN.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';

const router = Router();

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// GET /api/closed-periods -> danh sách các kỳ đã chốt, mới nhất trước.
router.get(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const periods = await prisma.closedPeriod.findMany({
      include: { closedBy: { select: { id: true, fullName: true } } },
      orderBy: { month: 'desc' },
    });
    res.json(periods);
  })
);

// POST /api/closed-periods  body: { month: "YYYY-MM", note }
router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { month, note } = req.body;
    if (!month || !MONTH_RE.test(month)) {
      return res.status(400).json({ message: 'Tháng không hợp lệ, định dạng YYYY-MM' });
    }
    const existing = await prisma.closedPeriod.findUnique({ where: { month } });
    if (existing) {
      return res.status(409).json({ message: `Kỳ ${month} đã được chốt sổ trước đó` });
    }
    const period = await prisma.closedPeriod.create({
      data: { month, note: note ?? null, closedById: req.employee.id },
      include: { closedBy: { select: { id: true, fullName: true } } },
    });
    await logAction(req, { action: 'PERIOD_CLOSE', entity: 'ClosedPeriod', entityId: period.id, detail: month });
    res.status(201).json(period);
  })
);

// DELETE /api/closed-periods/:month -> mở lại kỳ đã chốt (trường hợp chốt nhầm).
router.delete(
  '/:month',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { month } = req.params;
    const existing = await prisma.closedPeriod.findUnique({ where: { month } });
    if (!existing) return res.status(404).json({ message: 'Kỳ này chưa được chốt sổ' });
    await prisma.closedPeriod.delete({ where: { month } });
    await logAction(req, { action: 'PERIOD_REOPEN', entity: 'ClosedPeriod', entityId: existing.id, detail: month });
    res.json({ message: `Đã mở lại kỳ ${month}` });
  })
);

export default router;
