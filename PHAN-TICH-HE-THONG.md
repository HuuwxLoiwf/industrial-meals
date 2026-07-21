# Phân tích & Lộ trình hoàn thiện — Hệ thống Quản lý Suất ăn UMC Việt Nam

> Tài liệu này tổng hợp hiện trạng hệ thống và các hạng mục cần làm để đưa vào sử dụng thực tế tại nhà máy (quy mô ~5.000 công nhân).

---

## 1. Kiến trúc hiện tại

| Thành phần | Công nghệ |
|---|---|
| Frontend | React + Vite + Redux Toolkit + TailwindCSS + Recharts + Lucide |
| Backend | Node.js + Express 5 + Prisma ORM |
| CSDL | PostgreSQL (Neon serverless) |
| Xác thực | JWT thuần (email + mật khẩu, bcrypt) |
| Realtime | Socket.IO (cập nhật dashboard/tổng hợp tức thời) |
| Upload ảnh | Multer (ảnh món ăn lưu ổ đĩa `/uploads`) |

**Vai trò:** `EMPLOYEE` (công nhân), `MANAGER` (trưởng bộ phận/leader), `CANTEEN` (nhà ăn), `ADMIN` (quản trị).

---

## 2. Chức năng ĐÃ CÓ

- ✅ Đăng nhập JWT (admin `admin@gmail.com` / `admin`).
- ✅ Quản lý nhân viên: CRUD, tìm kiếm, **import Excel/CSV hàng loạt** (tự cấp mật khẩu = mã NV).
- ✅ Quản lý bộ phận, ca ăn (ngày/đêm, giờ tùy chỉnh).
- ✅ Quản lý thực đơn: lịch tháng, chọn món theo ngày, sao chép sang nhiều ngày, chặn ngày quá khứ.
- ✅ Kho món ăn: thêm/sửa/xóa mềm, upload & đổi ảnh, cảnh báo món thiếu ảnh.
- ✅ Đăng ký suất ăn cá nhân: 1 suất/ngày, xác nhận trước khi đăng ký, không cần duyệt.
- ✅ **Đăng ký theo lô** (leader nhập tổng số suất/ca) — tối ưu cho nhà máy đông người.
- ✅ Mã QR / mã 8 ký tự cho cả suất cá nhân lẫn lô.
- ✅ Phát cơm: quét mã lô, nhập số suất phát, trừ dần, chặn phát vượt.
- ✅ Tổng hợp: theo ca ăn, theo phòng ban (kèm danh sách NV đã/chưa đăng ký).
- ✅ Dashboard realtime + biểu đồ theo ca.
- ✅ Báo cáo tháng + ước tính chi phí.

---

## 2b. Đã bổ sung (3 giai đoạn hoàn thiện)

**Giai đoạn 1 — Bắt buộc:**
- ✅ Gộp số liệu đăng ký theo lô vào dashboard, tổng hợp ngày, báo cáo tháng.
- ✅ Ép đổi mật khẩu lần đầu (mustChangePassword) — chặn app tới khi đổi.
- ✅ Admin đặt lại mật khẩu nhân viên (về mã NV).
- ✅ Hạn chót đăng ký (cut-off time) theo ca — chặn đăng ký/hủy sau giờ quy định.
- ✅ Phân trang + tìm kiếm danh sách nhân viên phía server (chịu được hàng nghìn NV).

**Giai đoạn 2 — Hoàn thiện:**
- ✅ Xuất Excel báo cáo ngày (3 sheet: tổng hợp, chi tiết cá nhân, chi tiết lô) & báo cáo tháng.
- ✅ Cấu hình production: helmet (bảo mật header), compression, rate-limit (chống dò mật khẩu).
- ✅ Quét QR bằng camera (html5-qrcode) tại màn hình Phát cơm.

**Giai đoạn 3 — Nâng cao:**
- ✅ Đăng ký nhanh nhiều ngày (cả tuần) cho 1 ca.
- ✅ Thông báo in-app (chuông + admin gửi broadcast theo vai trò, realtime).
- ✅ Nhật ký hoạt động (audit log): ghi thêm/xóa NV, reset/đổi mật khẩu, cập nhật thực đơn.
- ✅ Thống kê nâng cao: tỷ lệ suất lãng phí, xu hướng theo ngày, món được lên thực đơn nhiều nhất.
- ✅ Quản lý suất lãng phí (đăng ký nhưng không nhận) — cảnh báo tỷ lệ để tiết kiệm chi phí.

---

## 2c. Rà soát & sửa lỗi logic (đợt kiểm tra toàn diện)

Sau khi hoàn thành 3 giai đoạn, hệ thống được kiểm tra chéo client ↔ server để tìm lỗi logic thực tế. Đã phát hiện và sửa:

1. **Đứt luồng phát cơm cho suất cá nhân.** Trang "Phát cơm" chỉ tra được mã LÔ, không tra được mã QR suất cá nhân của ADMIN → thêm endpoint `GET /batches/lookup?code=` phân biệt `type: 'batch' | 'individual'`, giao diện Phát cơm xử lý đúng cả hai luồng. Đã test end-to-end: đăng ký → tra mã → phát cơm → xác nhận trạng thái "đã nhận".
2. **Badge thông báo không tắt khi broadcast.** Trạng thái đọc trước đây là 1 cờ dùng chung trên bản ghi `Notification` — một người đọc thì cả công ty coi như đã đọc. Đã tách bảng `NotificationRead` (per-user), verify bằng 2 tài khoản độc lập: tài khoản A đọc xong, tài khoản B vẫn thấy đúng số chưa đọc của mình.
3. **Lệch giờ UTC ảnh hưởng ca đêm.** Toàn bộ logic "hôm nay" trước đây dùng giờ UTC — từ 00:00 đến 07:00 sáng giờ Việt Nam, hệ thống vẫn nghĩ là ngày hôm qua, làm sai hạn chót đăng ký và số liệu dashboard cho đúng khung giờ ca đêm 23:40/00:00 của nhà máy. Đã thêm `lib/dates.js` (server) tính theo giờ VN (UTC+7) dùng thống nhất ở mọi route.
4. **Xóa nhân viên là xóa cứng.** `DELETE /employees/:id` trước đây xóa vĩnh viễn, cascade xóa luôn lịch sử đăng ký → làm sai số liệu báo cáo các tháng trước. Đổi thành xóa mềm (`status: INACTIVE`), có nút "Kích hoạt lại", danh sách mặc định ẩn người đã vô hiệu hóa nhưng admin xem lại được.
5. **Dọn tàn dư luồng "duyệt đăng ký".** Từ khi đổi sang cơ chế không cần duyệt (đăng ký = APPROVED ngay), trang Duyệt đăng ký và endpoint `PATCH /:id/approve` trở thành code chết — đã xóa để tài liệu và code khớp nhau.
6. **Sinh mã check-in không chống trùng triệt để.** Gộp logic sinh mã 8 ký tự vào `lib/checkinCode.js`, kiểm tra trùng trong DB trước khi dùng (áp dụng cho cả đăng ký cá nhân lẫn theo lô).
7. **Socket.IO không xác thực.** Bất kỳ ai biết địa chỉ server đều kết nối được kênh realtime và nghe sự kiện nghiệp vụ. Đã thêm middleware xác thực JWT khi connect.
8. **Rate-limit theo IP không hợp lý cho nhà máy.** 5.000 công nhân ra Internet qua chung 1 IP NAT sẽ tranh nhau chung một hạn mức. Đổi giới hạn API (đã đăng nhập) sang tính theo từng tài khoản (JWT) thay vì theo IP; riêng giới hạn đăng nhập vẫn theo IP (chống dò mật khẩu) nhưng nới rộng hơn.
9. **`.env.example` chứa thông tin thật.** File mẫu môi trường vô tình chứa chuỗi kết nối CSDL và khóa bí mật thật (chưa từng bị commit lên Git). Đã thay bằng giá trị placeholder.

---

## 3. HẠNG MỤC CÒN LẠI (cần hạ tầng / dự án riêng)

Các mục dưới đây cần thiết bị thật hoặc là dự án riêng nhiều tuần, không làm trong phạm vi web hiện tại:

- **Ứng dụng di động** cho công nhân (React Native) — hoặc dùng web hiện tại như PWA.
- **Tích hợp máy chấm công / thẻ RFID** để nhận cơm — cần đầu đọc phần cứng.
- **Nhiều nhà máy / chi nhánh** (multi-tenant) — cần thiết kế lại mô hình dữ liệu.
- **Gửi thông báo qua Zalo / Email / SMS** — cần tài khoản dịch vụ bên thứ ba.
- **Màn hình hiển thị lớn tại nhà ăn** (số suất còn lại theo ca) — cần màn hình + máy đặt tại nhà ăn.

---

## 4. Việc cần làm khi ĐƯA LÊN PRODUCTION (vận hành thật)

1. **Biến môi trường thật:** đặt `JWT_SECRET` mạnh, `DATABASE_URL` production, `CLIENT_URL` domain thật.
2. **HTTPS + domain:** chạy sau nginx/Caddy, bật SSL. `trust proxy` đã bật sẵn.
3. **Backup CSDL định kỳ:** Neon có backup, nên bật snapshot hằng ngày.
4. **Ảnh món ăn:** hiện lưu ổ đĩa cục bộ — khi chạy nhiều máy chủ nên chuyển sang cloud storage (S3/Cloudinary).
5. **Đồng bộ giờ máy chủ:** tránh lệch giờ ảnh hưởng cut-off & thống kê.
6. **Đổi mật khẩu admin mặc định** `admin@gmail.com/admin` ngay khi bàn giao.
7. **Test tự động (khuyến nghị):** thêm bộ test cho các API cốt lõi để tránh lỗi hồi quy.

---

## 5. Tài khoản & cách dùng nhanh

- **Admin:** `admin@gmail.com` / `admin` (không bị buộc đổi — nên đổi khi bàn giao).
- **Nhân viên/leader:** mật khẩu mặc định = **mã NV viết thường**, buộc đổi ở lần đăng nhập đầu.
- **Leader (MANAGER):** dùng menu *Đăng ký theo lô* để nhập tổng số suất/ca.
- **Nhà ăn (CANTEEN):** dùng *Phát cơm* — quét QR bằng camera hoặc nhập mã lô, trừ dần số suất.
- **Admin:** *Quản trị → Ca ăn* đặt hạn chót đăng ký; *Thông báo* để gửi tin; *Nhật ký* để kiểm toán.

---

*Cập nhật lần cuối: 2026-07-01 — đã hoàn thành cả 3 giai đoạn (phần khả thi trong web).*
