// Kết nối Socket.io tới backend cho cập nhật realtime.
// autoConnect: false — chỉ kết nối sau khi có token (App.jsx gọi connectSocket()).
import { io } from 'socket.io-client';
import { getToken } from './api.js';

export const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
  autoConnect: false,
});

// Gọi sau khi đăng nhập thành công / khi app khởi động mà đã có token.
export function connectSocket() {
  const token = getToken();
  if (!token) return;
  socket.auth = { token };
  if (!socket.connected) socket.connect();
}

// Gọi khi đăng xuất để đóng kết nối realtime.
export function disconnectSocket() {
  if (socket.connected) socket.disconnect();
}
