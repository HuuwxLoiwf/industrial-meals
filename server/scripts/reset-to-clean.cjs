// Dọn sạch dữ liệu: xóa hết nhân viên/đăng ký/lô/thực đơn test, chỉ giữ lại
// 1 tài khoản ADMIN full quyền + 1 tài khoản LEADER (MANAGER) để leader đăng ký
// danh sách báo lên cho admin.
// Chạy: node scripts/reset-to-clean.cjs
const bcrypt = require('bcryptjs');

(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  console.log('Bắt đầu dọn dữ liệu...');

  // Xóa theo thứ tự phụ thuộc khóa ngoại.
  await prisma.mealRegistration.deleteMany({});
  await prisma.batchRegistration.deleteMany({});
  await prisma.notificationRead.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.dailyMenu.deleteMany({});
  await prisma.dish.deleteMany({});
  await prisma.employee.deleteMany({}); // xóa hết NV (kể cả admin cũ) để tạo lại sạch
  await prisma.department.deleteMany({});
  await prisma.mealShift.deleteMany({});

  console.log('✓ Đã xóa toàn bộ dữ liệu cũ.');

  // Tạo lại ca ăn thật (giữ nguyên khung giờ nhà máy đang dùng).
  const shifts = [
    { name: 'Ca ngay 11:40', period: 'DAY', startTime: '11:40', endTime: '12:20', durationMin: 40, order: 1 },
    { name: 'Ca ngay 12:00', period: 'DAY', startTime: '12:00', endTime: '12:40', durationMin: 40, order: 2 },
    { name: 'Ca ngay 12:25', period: 'DAY', startTime: '12:25', endTime: '13:05', durationMin: 40, order: 3 },
    { name: 'Ca dem 23:40', period: 'NIGHT', startTime: '23:40', endTime: '00:25', durationMin: 45, order: 4 },
    { name: 'Ca dem 00:00', period: 'NIGHT', startTime: '00:00', endTime: '00:45', durationMin: 45, order: 5 },
  ];
  for (const s of shifts) await prisma.mealShift.create({ data: s });
  console.log('✓ Đã tạo lại 5 ca ăn.');

  // 1 bộ phận mẫu để gán cho leader (admin có thể thêm bộ phận khác sau).
  const dept = await prisma.department.create({ data: { name: 'Phòng Sản Xuất' } });

  // Tài khoản ADMIN full quyền.
  const adminHash = await bcrypt.hash('admin', 10);
  const admin = await prisma.employee.create({
    data: {
      employeeCode: 'ADMIN',
      fullName: 'Quản trị viên',
      email: 'admin@gmail.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      mustChangePassword: false,
    },
  });
  console.log('✓ Admin:', admin.email, '/ admin');

  // Tài khoản LEADER (MANAGER) để đăng ký danh sách báo cho admin.
  const leaderHash = await bcrypt.hash('leader123', 10);
  const leader = await prisma.employee.create({
    data: {
      employeeCode: 'LEADER01',
      fullName: 'Trưởng bộ phận',
      email: 'leader@gmail.com',
      passwordHash: leaderHash,
      role: 'MANAGER',
      departmentId: dept.id,
      mustChangePassword: false,
    },
  });
  console.log('✓ Leader:', leader.email, '/ leader123');

  const total = await prisma.employee.count();
  console.log(`\nHoàn tất. Tổng số tài khoản trong hệ thống: ${total}`);
  await prisma.$disconnect();
  process.exit(0);
})();
