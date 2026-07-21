// Xem nhật ký hoạt động (audit log). Chỉ ADMIN.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// GET /api/audit?page=&pageSize=&action=
router.get(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 30));
    const where = {};
    if (req.query.action) where.action = req.query.action;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({ data: logs, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  })
);

export default router;
