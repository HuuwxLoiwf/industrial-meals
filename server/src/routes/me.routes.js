// Route lấy thông tin nhân viên hiện tại (đã đăng nhập).
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

// GET /api/me - trả về hồ sơ nhân viên + role để frontend điều hướng.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    // Không lộ passwordHash ra client.
    const { passwordHash, ...safe } = req.employee;
    res.json(safe);
  })
);

export default router;
