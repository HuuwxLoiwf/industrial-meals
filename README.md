<<<<<<< HEAD
# Hệ thống Đăng ký & Tổng hợp Suất ăn Công nghiệp — UMC Việt Nam

Hệ thống quản lý đăng ký, phát cơm qua QR, và tổng hợp báo cáo suất ăn hàng ngày tại nhà máy quy mô lớn (thiết kế cho ~5.000 công nhân).

## Kiến trúc

| Phần | Ngôn ngữ | Framework | Thư viện nền tảng |
|------|----------|-----------|-------------------|
| Backend (API) | JavaScript (Node.js ≥18, ESM) | Express 5 | Prisma, Socket.io, Multer, XLSX, bcryptjs, jsonwebtoken |
| Frontend Web | JavaScript / JSX | React 19 (Vite 7) | Redux Toolkit, React Router 7, Tailwind CSS v4, Recharts, Lucide |
| Database | SQL | PostgreSQL (Neon serverless) | Prisma + @prisma/adapter-neon |
| Auth | — | JWT thuần (email + mật khẩu) | bcryptjs (băm mật khẩu), jsonwebtoken |

## Cấu trúc thư mục

```
.
├── server/          # Backend Express 5 + Prisma
│   ├── prisma/      # Schema & migrations
│   └── src/         # Source code (ESM)
└── client/          # Frontend React 19 + Vite 7
    └── src/
```

## Vai trò (Roles)

- **EMPLOYEE** — Công nhân: không tự đăng ký suất ăn, suất ăn do trưởng bộ phận đăng ký theo lô.
- **MANAGER** — Trưởng bộ phận/leader: đăng ký theo lô (tổng số suất cho cả ca), xem báo cáo bộ phận mình.
- **CANTEEN** — Nhà ăn: xem tổng hợp, quét/nhập mã để phát cơm (trừ dần theo lô hoặc theo suất cá nhân).
- **ADMIN** — Quản trị: toàn quyền — quản lý nhân viên/bộ phận/ca ăn/thực đơn, đăng ký suất ăn đơn lẻ, báo cáo, nhật ký hoạt động.

## Cài đặt

### Backend

```bash
cd server
npm install
cp .env.example .env   # điền DATABASE_URL (Neon) + JWT_SECRET
npx prisma db push
node scripts/setup-accounts.cjs   # tạo tài khoản admin@gmail.com/admin
npm run dev
```

### Frontend

```bash
cd client
npm install
cp .env.example .env   # điền VITE_API_URL
npm run dev
```

Hoặc chạy cả hai cùng lúc bằng `run.bat` ở thư mục gốc (Windows).

## Đăng nhập

- **Admin:** `admin@gmail.com` / `admin`
- **Nhân viên/leader:** mật khẩu mặc định = **mã NV viết thường**, buộc đổi mật khẩu ở lần đăng nhập đầu.

## Module

1. Quản lý nhân viên (CRUD, import Excel/CSV hàng loạt, xóa mềm, reset mật khẩu)
2. Quản lý bộ phận
3. Quản lý ca ăn (giờ ăn + hạn chót đăng ký theo giờ Việt Nam)
4. Quản lý thực đơn (lịch tháng, sao chép, upload ảnh món)
5. Đăng ký suất ăn: đơn lẻ (ADMIN) hoặc theo lô (MANAGER/ADMIN)
6. Phát cơm qua mã QR/8 ký tự (quét camera hoặc nhập tay), trừ dần theo lô
7. Tổng hợp suất ăn (theo ca, theo phòng ban) + báo cáo tháng + xuất Excel
8. Thống kê nâng cao: tỷ lệ suất lãng phí, món phổ biến
9. Thông báo in-app (broadcast theo vai trò) + nhật ký hoạt động (audit log)

Xem chi tiết phân tích hệ thống, hạn chế, và hướng phát triển tại [PHAN-TICH-HE-THONG.md](PHAN-TICH-HE-THONG.md).
=======
# industrial-meals
>>>>>>> c1148e6826e4238e7eec401770bdbb2d35e1d786
