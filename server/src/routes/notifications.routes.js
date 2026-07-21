// Thông báo in-app: NV xem thông báo của mình; admin gửi broadcast.
// Trạng thái "đã đọc" lưu theo TỪNG người trong bảng NotificationRead
// (broadcast không thể dùng 1 cờ chung — 1 người đọc sẽ tắt badge của cả công ty).
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { emitEvent } from '../lib/realtime.js';
import { logAction } from '../lib/audit.js';

const router = Router();

// Điều kiện "thông báo dành cho tôi": gửi đích danh, theo role, hoặc cho tất cả.
function forMe(employee) {
  return {
    OR: [
      { employeeId: employee.id },
      { targetRole: employee.role },
      { targetRole: null, employeeId: null },
    ],
  };
}

// GET /api/notifications - 30 thông báo mới nhất + số chưa đọc (theo người dùng hiện tại).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.notification.findMany({
      where: forMe(req.employee),
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const reads = await prisma.notificationRead.findMany({
      where: { employeeId: req.employee.id, notificationId: { in: items.map((n) => n.id) } },
      select: { notificationId: true },
    });
    const readSet = new Set(reads.map((r) => r.notificationId));

    const withRead = items.map((n) => ({ ...n, read: readSet.has(n.id) }));
    res.json({ items: withRead, unread: withRead.filter((n) => !n.read).length });
  })
);

// PATCH /api/notifications/read-all - đánh dấu đã đọc (chỉ cho người dùng hiện tại).
router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const items = await prisma.notification.findMany({
      where: forMe(req.employee),
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true },
    });
    if (items.length) {
      await prisma.notificationRead.createMany({
        data: items.map((n) => ({ notificationId: n.id, employeeId: req.employee.id })),
        skipDuplicates: true,
      });
    }
    res.json({ message: 'ok' });
  })
);

// POST /api/notifications - admin gửi thông báo.
// body: { title, body, targetRole? } -> broadcast theo role (hoặc tất cả nếu để trống)
// body: { title, body, employeeId } -> gửi đích danh 1 nhân viên
router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { title, body, targetRole, employeeId } = req.body;
    if (!title) return res.status(400).json({ message: 'Thiếu tiêu đề' });

    let targetLabel = 'Tất cả mọi người';
    if (employeeId) {
      const target = await prisma.employee.findUnique({ where: { id: employeeId } });
      if (!target) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
      targetLabel = target.fullName;
    } else if (targetRole) {
      targetLabel = targetRole;
    }

    const noti = await prisma.notification.create({
      data: {
        title,
        body: body || null,
        targetRole: employeeId ? null : targetRole || null,
        employeeId: employeeId || null,
      },
    });

    await logAction(req, {
      action: 'NOTIFICATION_SEND',
      entity: 'Notification',
      entityId: noti.id,
      detail: `"${title}" -> ${targetLabel}`,
    });

    emitEvent('notification:created', { id: noti.id });
    res.status(201).json(noti);
  })
);

export default router;
