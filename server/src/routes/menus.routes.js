// Quản lý thực đơn theo ngày (DailyMenu). Xem: mọi người. Sửa: ADMIN & CANTEEN.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';
import { todayVNStr, monthVNStr } from '../lib/dates.js';
import { isPeriodClosed } from '../lib/closedPeriod.js';
import { upload } from '../lib/upload.js';

const router = Router();

function parseDate(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Ngày hôm nay ở dạng Date (UTC midnight) để so sánh "ngày quá khứ".
function todayUtc() {
  return parseDate(todayVNStr());
}

// GET /api/menus?date=YYYY-MM-DD  -> thực đơn của ngày (kèm món + ảnh).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const date = parseDate(req.query.date) || parseDate(todayVNStr());
    const menu = await prisma.dailyMenu.findUnique({
      where: { menuDate: date },
      include: { items: { include: { dish: true } } },
    });
    if (!menu) {
      return res.json({ menuDate: req.query.date, items: [], note: null });
    }
    res.json(menu);
  })
);

// GET /api/menus/month?month=YYYY-MM  -> tất cả thực đơn trong tháng.
// Trả về map { "YYYY-MM-DD": { items, note } } để frontend vẽ lịch.
router.get(
  '/month',
  asyncHandler(async (req, res) => {
    const month = req.query.month || monthVNStr();
    const start = parseDate(`${month}-01`);
    if (!start) return res.status(400).json({ message: 'Tháng không hợp lệ' });
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const menus = await prisma.dailyMenu.findMany({
      where: { menuDate: { gte: start, lt: end } },
      include: { items: { include: { dish: true } } },
    });

    const byDate = {};
    for (const m of menus) {
      const key = m.menuDate.toISOString().slice(0, 10);
      byDate[key] = {
        note: m.note,
        dishes: m.items.map((i) => i.dish),
      };
    }
    res.json({ month, byDate });
  })
);

// POST /api/menus/copy  body: { fromDate, toDates: [] }
// Sao chép danh sách món của 1 ngày sang nhiều ngày khác.
router.post(
  '/copy',
  requireRole('ADMIN', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const { fromDate, toDates = [] } = req.body;
    const from = parseDate(fromDate);
    if (!from || toDates.length === 0) {
      return res.status(400).json({ message: 'Thiếu ngày nguồn hoặc ngày đích' });
    }

    const source = await prisma.dailyMenu.findUnique({
      where: { menuDate: from },
      include: { items: true },
    });
    if (!source) {
      return res.status(404).json({ message: 'Ngày nguồn chưa có thực đơn' });
    }
    const dishIds = source.items.map((i) => i.dishId);

    const today = todayUtc();
    let copied = 0;
    for (const d of toDates) {
      const target = parseDate(d);
      if (!target) continue;
      if (target < today) continue; // bỏ qua ngày quá khứ
      if (await isPeriodClosed(target)) continue; // bỏ qua ngày thuộc kỳ đã chốt sổ
      const menu = await prisma.dailyMenu.upsert({
        where: { menuDate: target },
        update: { note: source.note },
        create: { menuDate: target, note: source.note },
      });
      await prisma.menuItem.deleteMany({ where: { menuId: menu.id } });
      if (dishIds.length) {
        await prisma.menuItem.createMany({
          data: dishIds.map((dishId) => ({ menuId: menu.id, dishId })),
          skipDuplicates: true,
        });
      }
      copied += 1;
    }
    res.json({ copied });
  })
);

// PUT /api/menus  body: { date, dishIds: [], note }  -> tạo/cập nhật thực đơn ngày.
router.put(
  '/',
  requireRole('ADMIN', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const { date, dishIds = [], note } = req.body;
    const menuDate = parseDate(date);
    if (!menuDate) return res.status(400).json({ message: 'Ngày không hợp lệ' });
    if (menuDate < todayUtc()) {
      return res.status(400).json({ message: 'Không thể lên thực đơn cho ngày trong quá khứ' });
    }
    if (await isPeriodClosed(menuDate)) {
      return res.status(400).json({ message: `Kỳ ${date.slice(0, 7)} đã được chốt sổ, không thể sửa thực đơn.` });
    }

    const menu = await prisma.dailyMenu.upsert({
      where: { menuDate },
      update: { note: note ?? null },
      create: { menuDate, note: note ?? null },
    });

    // Đồng bộ danh sách món: xóa hết rồi thêm lại theo dishIds.
    await prisma.menuItem.deleteMany({ where: { menuId: menu.id } });
    if (dishIds.length) {
      await prisma.menuItem.createMany({
        data: dishIds.map((dishId) => ({ menuId: menu.id, dishId })),
        skipDuplicates: true,
      });
    }

    const full = await prisma.dailyMenu.findUnique({
      where: { id: menu.id },
      include: { items: { include: { dish: true } } },
    });
    await logAction(req, { action: 'MENU_UPDATE', entity: 'DailyMenu', entityId: menu.id, detail: date });
    res.json(full);
  })
);

// POST /api/menus/quick-setup  (multipart/form-data)
// Lên thực đơn CẢ NGÀY trong 1 lần: mỗi slot (2 món chính, 1 phụ, 1 tráng miệng,
// 1 cải tiến) có thể là món MỚI (nhập tên + ảnh) hoặc chọn lại món CÓ SẴN.
//
// Field text: date, note, slots (JSON string)
//   slots = [{ key, category, dishId? , name? , description? }]
// Field file: ảnh của slot mới đặt tên "image_<key>" (vd image_main1).
router.post(
  '/quick-setup',
  requireRole('ADMIN', 'CANTEEN'),
  upload.any(),
  asyncHandler(async (req, res) => {
    const { date, note } = req.body;
    const menuDate = parseDate(date);
    if (!menuDate) return res.status(400).json({ message: 'Ngày không hợp lệ' });
    if (menuDate < todayUtc()) {
      return res.status(400).json({ message: 'Không thể lên thực đơn cho ngày trong quá khứ' });
    }
    if (await isPeriodClosed(menuDate)) {
      return res.status(400).json({ message: `Kỳ ${date.slice(0, 7)} đã được chốt sổ, không thể sửa thực đơn.` });
    }

    let slots;
    try {
      slots = JSON.parse(req.body.slots || '[]');
    } catch {
      return res.status(400).json({ message: 'Dữ liệu món ăn không hợp lệ' });
    }
    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ message: 'Chưa có món nào để lên thực đơn' });
    }

    const CATEGORIES = ['MAIN', 'SIDE', 'DESSERT', 'ALTERNATIVE'];
    // Ảnh gửi kèm: map theo tên field "image_<key>".
    const fileByKey = {};
    for (const f of req.files || []) {
      if (f.fieldname.startsWith('image_')) fileByKey[f.fieldname.slice(6)] = f;
    }

    const dishIds = [];
    const createdDishes = [];
    for (const slot of slots) {
      // Dùng lại món có sẵn.
      if (slot.dishId) {
        const exists = await prisma.dish.findUnique({ where: { id: slot.dishId } });
        if (exists) dishIds.push(exists.id);
        continue;
      }
      // Tạo món mới từ tên + ảnh (nếu có).
      const name = (slot.name || '').trim();
      if (!name) continue; // slot bỏ trống -> bỏ qua
      if (!CATEGORIES.includes(slot.category)) {
        return res.status(400).json({ message: `Loại món không hợp lệ: ${slot.category}` });
      }
      const file = fileByKey[slot.key];
      const dish = await prisma.dish.create({
        data: {
          name,
          category: slot.category,
          description: (slot.description || '').trim() || null,
          imageUrl: file ? `/uploads/${file.filename}` : null,
        },
      });
      createdDishes.push(dish.name);
      dishIds.push(dish.id);
    }

    if (dishIds.length === 0) {
      return res.status(400).json({ message: 'Chưa nhập món nào' });
    }

    const menu = await prisma.dailyMenu.upsert({
      where: { menuDate },
      update: { note: note ?? null },
      create: { menuDate, note: note ?? null },
    });
    await prisma.menuItem.deleteMany({ where: { menuId: menu.id } });
    await prisma.menuItem.createMany({
      data: dishIds.map((dishId) => ({ menuId: menu.id, dishId })),
      skipDuplicates: true,
    });

    const full = await prisma.dailyMenu.findUnique({
      where: { id: menu.id },
      include: { items: { include: { dish: true } } },
    });

    await logAction(req, {
      action: 'MENU_QUICK_SETUP',
      entity: 'DailyMenu',
      entityId: menu.id,
      detail: `${date}: ${dishIds.length} món${createdDishes.length ? ` (mới: ${createdDishes.join(', ')})` : ''}`,
    });

    res.status(201).json({ menu: full, createdCount: createdDishes.length });
  })
);

export default router;
