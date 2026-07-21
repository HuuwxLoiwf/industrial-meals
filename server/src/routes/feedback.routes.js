// Phản hồi / góp ý về bữa ăn: công nhân gửi (kèm đánh giá GOOD/NORMAL/BAD),
// nhà ăn & admin xem và trả lời. Giúp cải thiện chất lượng suất ăn.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';
import { emitEvent } from '../lib/realtime.js';
import { todayVNStr, parseMealDate } from '../lib/dates.js';

const router = Router();

const RATINGS = ['GOOD', 'NORMAL', 'BAD'];

// GET /api/feedback/mine — công nhân xem góp ý của chính mình.
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const list = await prisma.mealFeedback.findMany({
      where: { employeeId: req.employee.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(list);
  })
);

// POST /api/feedback  body: { content, rating?, mealDate? } — mọi nhân viên gửi được.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const content = (req.body.content || '').trim();
    if (!content) return res.status(400).json({ message: 'Vui lòng nhập nội dung góp ý' });
    if (content.length > 1000) return res.status(400).json({ message: 'Nội dung quá dài (tối đa 1000 ký tự)' });
    const rating = RATINGS.includes(req.body.rating) ? req.body.rating : null;
    const mealDate = parseMealDate(req.body.mealDate) || parseMealDate(todayVNStr());

    const fb = await prisma.mealFeedback.create({
      data: { employeeId: req.employee.id, content, rating, mealDate },
    });
    emitEvent('feedback:created', { id: fb.id });
    res.status(201).json(fb);
  })
);

// GET /api/feedback?status=OPEN&date= — nhà ăn/admin xem tất cả góp ý.
router.get(
  '/',
  requireRole('CANTEEN', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.status === 'OPEN' || req.query.status === 'RESOLVED') where.status = req.query.status;
    const date = parseMealDate(req.query.date);
    if (date) where.mealDate = date;

    const list = await prisma.mealFeedback.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
      include: { employee: { select: { fullName: true, employeeCode: true, department: { select: { name: true } } } } },
    });
    res.json(list);
  })
);

// GET /api/feedback/summary?date= — thống kê nhanh số góp ý theo mức đánh giá.
router.get(
  '/summary',
  requireRole('CANTEEN', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const date = parseMealDate(req.query.date) || parseMealDate(todayVNStr());
    const list = await prisma.mealFeedback.findMany({ where: { mealDate: date }, select: { rating: true, status: true } });
    const summary = { total: list.length, good: 0, normal: 0, bad: 0, open: 0 };
    for (const f of list) {
      if (f.rating === 'GOOD') summary.good++;
      else if (f.rating === 'NORMAL') summary.normal++;
      else if (f.rating === 'BAD') summary.bad++;
      if (f.status === 'OPEN') summary.open++;
    }
    res.json(summary);
  })
);

// PATCH /api/feedback/:id/reply  body: { reply } — nhà ăn/admin trả lời & đóng góp ý.
router.patch(
  '/:id/reply',
  requireRole('CANTEEN', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const reply = (req.body.reply || '').trim();
    if (!reply) return res.status(400).json({ message: 'Vui lòng nhập nội dung phản hồi' });
    const existing = await prisma.mealFeedback.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy góp ý' });

    const fb = await prisma.mealFeedback.update({
      where: { id: req.params.id },
      data: {
        reply,
        status: 'RESOLVED',
        repliedById: req.employee.id,
        repliedByName: req.employee.fullName,
        repliedAt: new Date(),
      },
    });

    // Gửi thông báo cho người gửi góp ý biết đã có phản hồi.
    await prisma.notification.create({
      data: {
        employeeId: existing.employeeId,
        title: 'Góp ý của bạn đã được phản hồi',
        body: reply.slice(0, 160),
      },
    });
    emitEvent('notification:created', { employeeId: existing.employeeId });
    await logAction(req, { action: 'FEEDBACK_REPLY', entity: 'MealFeedback', entityId: fb.id });
    res.json(fb);
  })
);

export default router;
