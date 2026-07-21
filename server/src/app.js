// Cấu hình Express 5 app: middleware, route, xử lý lỗi.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

import { requireAuth, attachEmployee } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/error.js';
import prisma from './lib/prisma.js';
import { asyncHandler } from './lib/asyncHandler.js';

import authRoutes from './routes/auth.routes.js';
import meRoutes from './routes/me.routes.js';
import departmentRoutes from './routes/departments.routes.js';
import shiftRoutes from './routes/shifts.routes.js';
import employeeRoutes from './routes/employees.routes.js';
import registrationRoutes from './routes/registrations.routes.js';
import batchRoutes from './routes/batches.routes.js';
import summaryRoutes from './routes/summary.routes.js';
import exportRoutes from './routes/export.routes.js';
import notificationRoutes from './routes/notifications.routes.js';
import auditRoutes from './routes/audit.routes.js';
import dishRoutes from './routes/dishes.routes.js';
import menuRoutes from './routes/menus.routes.js';
import closedPeriodRoutes from './routes/closedPeriods.routes.js';
import dishVoteRoutes from './routes/dishVotes.routes.js';
import weeklyScheduleRoutes from './routes/weeklySchedule.routes.js';
import nonServiceDayRoutes from './routes/nonServiceDays.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import ingredientRoutes from './routes/ingredients.routes.js';
import consumptionRoutes from './routes/consumption.routes.js';
import accountRequestRoutes from './routes/accountRequests.routes.js';
import boardRoutes from './routes/board.routes.js';
import { UPLOAD_DIR } from './lib/upload.js';

export function createApp() {
  const app = express();

  // Đứng sau reverse proxy (nginx) khi deploy -> tin cậy X-Forwarded-* để rate-limit đúng IP.
  app.set('trust proxy', 1);

  // Bảo mật header + nén phản hồi.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());

  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));

  // Healthcheck (không cần auth).
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Phục vụ ảnh món ăn (public, không cần auth).
  app.use('/uploads', express.static(UPLOAD_DIR));

  // Giới hạn tần suất đăng nhập: chống dò mật khẩu.
  // 60 lần/15 phút/IP — nới rộng vì cả nhà máy có thể ra ngoài qua chung 1 IP NAT
  // (nhiều người đăng nhập cùng lúc vào đầu ca). Vẫn đủ chặn brute-force tự động.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Quá nhiều lần thử. Vui lòng đợi ít phút rồi thử lại.' },
  });
  // Giới hạn chung cho API, tính theo TỪNG TÀI KHOẢN (Bearer token) chứ không theo IP.
  // Lý do: cả nhà máy 5.000 người thường ra Internet qua chung 1 IP NAT/proxy — nếu
  // giới hạn theo IP thì mọi người sẽ tranh nhau 1 hạn mức và bị chặn oan.
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120, // 120 request/phút/tài khoản là dư cho thao tác thông thường
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const authHeader = req.headers.authorization || '';
      // Dùng ipKeyGenerator() thay vì req.ip trực tiếp: express-rate-limit yêu cầu
      // chuẩn hóa IPv6 qua helper này để tránh bị bypass giới hạn (rút gọn địa chỉ).
      return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ipKeyGenerator(req.ip);
    },
  });

  // Auth: login / đổi mật khẩu (login không cần token).
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth', authRoutes);

  app.use('/api', apiLimiter);

  // ===== Các endpoint KHÔNG cần đăng nhập =====
  // Tự đăng ký tài khoản (phần quản trị bên trong route tự kiểm tra quyền ADMIN).
  app.use('/api/account-requests', accountRequestRoutes);
  // Danh sách bộ phận rút gọn để form đăng ký chọn được khi chưa có tài khoản.
  app.get(
    '/api/public/departments',
    asyncHandler(async (req, res) => {
      const list = await prisma.department.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      res.json(list);
    })
  );
  // Góp ý nhanh (bấm mặt cười) từ màn hình trình chiếu ở nhà ăn — ẩn danh.
  app.use('/api/board', boardRoutes);

  // Từ đây trở đi bắt buộc đăng nhập (JWT Bearer token).
  app.use('/api', requireAuth, attachEmployee);

  app.use('/api/me', meRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/shifts', shiftRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/registrations', registrationRoutes);
  app.use('/api/batches', batchRoutes);
  app.use('/api/summary', summaryRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/dishes', dishRoutes);
  app.use('/api/menus', menuRoutes);
  app.use('/api/closed-periods', closedPeriodRoutes);
  app.use('/api/dish-votes', dishVoteRoutes);
  app.use('/api/weekly-schedules', weeklyScheduleRoutes);
  app.use('/api/non-service-days', nonServiceDayRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/ingredients', ingredientRoutes);
  app.use('/api/consumption', consumptionRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
