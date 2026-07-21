// Khẩu phần / nguyên liệu: định lượng nguyên liệu cho 1 suất mỗi món, và tính
// TỔNG nguyên liệu cần chuẩn bị cho 1 ngày = định lượng x số suất đã báo.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { todayVNStr, parseMealDate } from '../lib/dates.js';

const router = Router();

// GET /api/ingredients/dish/:dishId — danh sách nguyên liệu của 1 món.
router.get(
  '/dish/:dishId',
  requireRole('CANTEEN', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const list = await prisma.dishIngredient.findMany({
      where: { dishId: req.params.dishId },
      orderBy: { name: 'asc' },
    });
    res.json(list);
  })
);

// PUT /api/ingredients/dish/:dishId  body: { ingredients: [{ name, quantity, unit }] }
// Đồng bộ toàn bộ danh sách nguyên liệu của 1 món (xóa cũ, ghi mới).
router.put(
  '/dish/:dishId',
  requireRole('CANTEEN', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const dish = await prisma.dish.findUnique({ where: { id: req.params.dishId } });
    if (!dish) return res.status(404).json({ message: 'Không tìm thấy món ăn' });

    const rows = Array.isArray(req.body.ingredients) ? req.body.ingredients : [];
    const clean = rows
      .map((r) => ({
        name: (r.name || '').trim(),
        quantity: Math.max(0, Number(r.quantity) || 0),
        unit: (r.unit || 'g').trim() || 'g',
      }))
      .filter((r) => r.name);

    await prisma.dishIngredient.deleteMany({ where: { dishId: req.params.dishId } });
    if (clean.length) {
      await prisma.dishIngredient.createMany({
        data: clean.map((c) => ({ ...c, dishId: req.params.dishId })),
      });
    }
    const list = await prisma.dishIngredient.findMany({ where: { dishId: req.params.dishId }, orderBy: { name: 'asc' } });
    res.json(list);
  })
);

// GET /api/ingredients/shopping-list?date=YYYY-MM-DD
// Tổng nguyên liệu cần mua cho 1 ngày: dựa trên thực đơn ngày đó + số suất đã báo (lô).
router.get(
  '/shopping-list',
  requireRole('CANTEEN', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const dateStr = req.query.date || todayVNStr();
    const date = parseMealDate(dateStr);

    const [menu, batches, regs] = await Promise.all([
      prisma.dailyMenu.findUnique({
        where: { menuDate: date },
        include: { items: { include: { dish: { include: { ingredients: true } } } } },
      }),
      prisma.batchRegistration.findMany({ where: { mealDate: date }, select: { qtyStandard: true, qtyAlternative: true } }),
      prisma.mealRegistration.findMany({ where: { mealDate: date, status: { not: 'CANCELLED' } }, select: { mealType: true } }),
    ]);

    // Tổng số suất thường & cải tiến đã báo cho ngày.
    const totalStandard =
      batches.reduce((s, b) => s + b.qtyStandard, 0) + regs.filter((r) => r.mealType === 'STANDARD').length;
    const totalAlternative =
      batches.reduce((s, b) => s + b.qtyAlternative, 0) + regs.filter((r) => r.mealType === 'ALTERNATIVE').length;

    if (!menu) {
      return res.json({ date: dateStr, totalStandard, totalAlternative, ingredients: [], missingIngredientDishes: [] });
    }

    // Món cải tiến (ALTERNATIVE) tính theo số suất cải tiến; các món còn lại theo số suất thường.
    const aggregate = {}; // key: "name|unit"
    const missing = [];
    for (const item of menu.items) {
      const dish = item.dish;
      const portions = dish.category === 'ALTERNATIVE' ? totalAlternative : totalStandard;
      if (dish.ingredients.length === 0) {
        missing.push(dish.name);
        continue;
      }
      for (const ing of dish.ingredients) {
        const key = `${ing.name}|${ing.unit}`;
        aggregate[key] ??= { name: ing.name, unit: ing.unit, quantity: 0 };
        aggregate[key].quantity += ing.quantity * portions;
      }
    }

    const ingredients = Object.values(aggregate).sort((a, b) => a.name.localeCompare(b.name));
    res.json({ date: dateStr, totalStandard, totalAlternative, ingredients, missingIngredientDishes: missing });
  })
);

export default router;
