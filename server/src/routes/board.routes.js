// Endpoint cho MÀN HÌNH TRÌNH CHIẾU ở nhà ăn — không cần đăng nhập.
// Công nhân bấm mặt cười ngay trên TV để đánh giá nhanh bữa ăn hôm nay.
import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { emitEvent } from '../lib/realtime.js';
import { todayVNStr, parseMealDate } from '../lib/dates.js';

const router = Router();

const RATINGS = ['GOOD', 'NORMAL', 'BAD'];

// Chống bấm spam từ 1 màn hình: tối đa 60 lượt/phút/IP (nhiều người dùng chung
// 1 TV nên không siết quá chặt, nhưng đủ chặn giữ nút hoặc script).
const boardLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  message: { message: 'Bạn bấm hơi nhanh, vui lòng thử lại sau giây lát.' },
});

// POST /api/board/quick-rating  body: { rating }  — ẩn danh, từ màn hình TV.
router.post(
  '/quick-rating',
  boardLimiter,
  asyncHandler(async (req, res) => {
    const { rating } = req.body;
    if (!RATINGS.includes(rating)) {
      return res.status(400).json({ message: 'Đánh giá không hợp lệ' });
    }
    const mealDate = parseMealDate(todayVNStr());

    await prisma.mealFeedback.create({
      data: {
        employeeId: null, // ẩn danh
        fromBoard: true,
        rating,
        content: null,
        mealDate,
        // Đánh giá nhanh không cần nhà ăn trả lời từng cái -> đóng luôn.
        status: 'RESOLVED',
      },
    });

    emitEvent('feedback:created', { fromBoard: true });
    res.status(201).json({ message: 'Cảm ơn bạn đã đánh giá!' });
  })
);

// GET /api/board/quick-rating/summary — số lượt đánh giá nhanh hôm nay (hiện trên TV).
router.get(
  '/quick-rating/summary',
  asyncHandler(async (req, res) => {
    const mealDate = parseMealDate(todayVNStr());
    const rows = await prisma.mealFeedback.findMany({
      where: { mealDate, fromBoard: true },
      select: { rating: true },
    });
    const summary = { good: 0, normal: 0, bad: 0, total: rows.length };
    for (const r of rows) {
      if (r.rating === 'GOOD') summary.good++;
      else if (r.rating === 'NORMAL') summary.normal++;
      else if (r.rating === 'BAD') summary.bad++;
    }
    res.json(summary);
  })
);

export default router;
