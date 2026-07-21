// Bình chọn món ăn: mỗi nhân viên vote thích/không thích cho từng món trong thực đơn
// ngày hôm đó. Dùng để nhà ăn biết món nào được yêu thích, món nào cần cải thiện.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { todayVNStr, parseMealDate } from '../lib/dates.js';
import { emitEvent, EVENTS } from '../lib/realtime.js';

const router = Router();

// GET /api/dish-votes/mine?date=YYYY-MM-DD -> vote của chính mình trong ngày (để tô sáng UI đã chọn).
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const date = parseMealDate(req.query.date) || parseMealDate(todayVNStr());
    const votes = await prisma.dishVote.findMany({
      where: { employeeId: req.employee.id, menuDate: date },
    });
    res.json(votes);
  })
);

// POST /api/dish-votes  body: { dishId, menuDate, liked }
// Vote hoặc đổi vote (upsert theo unique employeeId+dishId+menuDate).
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { dishId, menuDate, liked } = req.body;
    const date = parseMealDate(menuDate) || parseMealDate(todayVNStr());
    if (!dishId || typeof liked !== 'boolean') {
      return res.status(400).json({ message: 'Thiếu món ăn hoặc giá trị bình chọn' });
    }

    const dish = await prisma.dish.findUnique({ where: { id: dishId } });
    if (!dish) return res.status(404).json({ message: 'Không tìm thấy món ăn' });

    // Chỉ cho vote món có trong thực đơn của đúng ngày đó.
    const menu = await prisma.dailyMenu.findUnique({
      where: { menuDate: date },
      include: { items: true },
    });
    if (!menu || !menu.items.some((i) => i.dishId === dishId)) {
      return res.status(400).json({ message: 'Món này không có trong thực đơn ngày đã chọn' });
    }

    const vote = await prisma.dishVote.upsert({
      where: { employeeId_dishId_menuDate: { employeeId: req.employee.id, dishId, menuDate: date } },
      update: { liked },
      create: { employeeId: req.employee.id, dishId, menuDate: date, liked },
    });

    emitEvent(EVENTS.DISH_VOTE_UPDATED, { dishId, menuDate: menuDate || todayVNStr() });
    res.status(201).json(vote);
  })
);

// GET /api/dish-votes/stats?date=YYYY-MM-DD -> thống kê thích/không thích theo món trong ngày. CANTEEN/ADMIN.
router.get(
  '/stats',
  requireRole('CANTEEN', 'ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const date = parseMealDate(req.query.date) || parseMealDate(todayVNStr());
    const menu = await prisma.dailyMenu.findUnique({
      where: { menuDate: date },
      include: { items: { include: { dish: true } } },
    });
    if (!menu) return res.json([]);

    const votes = await prisma.dishVote.findMany({ where: { menuDate: date } });
    const byDish = {};
    for (const v of votes) {
      byDish[v.dishId] ??= { liked: 0, disliked: 0 };
      if (v.liked) byDish[v.dishId].liked++;
      else byDish[v.dishId].disliked++;
    }

    const stats = menu.items.map((item) => ({
      dish: item.dish,
      liked: byDish[item.dishId]?.liked || 0,
      disliked: byDish[item.dishId]?.disliked || 0,
    }));
    stats.sort((a, b) => (b.liked - b.disliked) - (a.liked - a.disliked));
    res.json(stats);
  })
);

export default router;
