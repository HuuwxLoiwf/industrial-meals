// Quản lý món ăn (Dish) + upload ảnh. ADMIN & CANTEEN.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { upload } from '../lib/upload.js';
import { logAction } from '../lib/audit.js';

const router = Router();

const CATEGORIES = ['MAIN', 'SIDE', 'DESSERT', 'ALTERNATIVE'];

// GET /api/dishes?category=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = { active: true };
    if (req.query.category) where.category = req.query.category;
    const dishes = await prisma.dish.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(dishes);
  })
);

// POST /api/dishes  (multipart: name, category, description, image)
router.post(
  '/',
  requireRole('ADMIN', 'CANTEEN'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { name, category, description } = req.body;
    if (!name || !CATEGORIES.includes(category)) {
      return res.status(400).json({ message: 'Thiếu tên hoặc loại món không hợp lệ' });
    }
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const dish = await prisma.dish.create({
      data: { name, category, description: description || null, imageUrl },
    });
    await logAction(req, { action: 'DISH_CREATE', entity: 'Dish', entityId: dish.id, detail: dish.name });
    res.status(201).json(dish);
  })
);

// PUT /api/dishes/:id  (có thể kèm ảnh mới)
router.put(
  '/:id',
  requireRole('ADMIN', 'CANTEEN'),
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { name, category, description } = req.body;
    const data = { name, category, description };
    if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;
    const dish = await prisma.dish.update({
      where: { id: req.params.id },
      data,
    });
    await logAction(req, { action: 'DISH_UPDATE', entity: 'Dish', entityId: dish.id, detail: dish.name });
    res.json(dish);
  })
);

// DELETE /api/dishes/:id  (xóa mềm: active=false để giữ lịch sử thực đơn)
router.delete(
  '/:id',
  requireRole('ADMIN', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const dish = await prisma.dish.update({
      where: { id: req.params.id },
      data: { active: false },
    });
    await logAction(req, { action: 'DISH_DELETE', entity: 'Dish', entityId: dish.id, detail: dish.name });
    res.status(204).end();
  })
);

// GET /api/dishes/inactive - xem lại món đã ẩn để có thể khôi phục.
router.get(
  '/inactive',
  requireRole('ADMIN', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const dishes = await prisma.dish.findMany({
      where: { active: false },
      orderBy: { name: 'asc' },
    });
    res.json(dishes);
  })
);

// POST /api/dishes/:id/restore - khôi phục món đã ẩn.
router.post(
  '/:id/restore',
  requireRole('ADMIN', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const dish = await prisma.dish.update({
      where: { id: req.params.id },
      data: { active: true },
    });
    await logAction(req, { action: 'DISH_RESTORE', entity: 'Dish', entityId: dish.id, detail: dish.name });
    res.json(dish);
  })
);

export default router;
