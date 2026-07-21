// Điểm khởi động: tạo HTTP server, gắn Socket.io, lắng nghe cổng.
import 'dotenv/config';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';

import { createApp } from './app.js';
import { setIo } from './lib/realtime.js';
import { verifyToken } from './lib/jwt.js';
import { generateForToday } from './lib/generateSchedules.js';

const PORT = process.env.PORT || 5000;

const app = createApp();
const httpServer = createServer(app);

const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  },
});
setIo(io);

// Yêu cầu JWT hợp lệ khi kết nối realtime (tránh client lạ nghe lén sự kiện nghiệp vụ).
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Thiếu token'));
  try {
    socket.data.employeeId = verifyToken(token).sub;
    next();
  } catch {
    next(new Error('Token không hợp lệ'));
  }
});

io.on('connection', (socket) => {
  console.log(`[socket] client kết nối: ${socket.id} (employee: ${socket.data.employeeId})`);
  socket.on('disconnect', () => {
    console.log(`[socket] client ngắt: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🍱 API chạy tại http://localhost:${PORT}`);
});

// Tự sinh lô từ lịch định kỳ: chạy ngay lúc khởi động rồi lặp lại mỗi giờ.
// Không cần chính xác theo giờ vì hàm idempotent theo ngày (lastGeneratedDate).
generateForToday().catch((err) => console.error('[generateForToday] lỗi:', err));
setInterval(() => {
  generateForToday().catch((err) => console.error('[generateForToday] lỗi:', err));
}, 60 * 60 * 1000);
