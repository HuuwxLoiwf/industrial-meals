// Tạo tài khoản admin + cấp mật khẩu mặc định cho nhân viên chưa có.
//  - admin@gmail.com / admin (role ADMIN)
//  - Mỗi NV chưa có passwordHash: mật khẩu mặc định = mã NV (lowercase)
//  - 2 email test: leader ca sáng (MANAGER) + để test đăng ký theo lô
// Chạy: node scripts/setup-accounts.cjs
const bcrypt = require('bcryptjs');

(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  // 1) Admin
  const adminHash = await bcrypt.hash('admin', 10);
  const admin = await prisma.employee.upsert({
    where: { email: 'admin@gmail.com' },
    update: { passwordHash: adminHash, role: 'ADMIN', status: 'ACTIVE', mustChangePassword: false },
    create: {
      employeeCode: 'ADMIN',
      fullName: 'Quản trị viên',
      email: 'admin@gmail.com',
      passwordHash: adminHash,
      role: 'ADMIN',
      mustChangePassword: false,
    },
  });
  console.log('✓ Admin:', admin.email, '/ admin');

  // 2) Cấp mật khẩu mặc định = mã NV cho những NV chưa có passwordHash.
  const noPass = await prisma.employee.findMany({
    where: { passwordHash: null },
    select: { id: true, employeeCode: true, email: true },
  });
  let count = 0;
  for (const e of noPass) {
    const pass = (e.employeeCode || 'nhanvien').toLowerCase();
    const hash = await bcrypt.hash(pass, 10);
    await prisma.employee.update({ where: { id: e.id }, data: { passwordHash: hash } });
    count++;
  }
  console.log(`✓ Cấp mật khẩu mặc định (= mã NV) cho ${count} nhân viên`);

  // 3) Nâng 1 email test thành MANAGER (leader ca sáng) để test đăng ký theo lô.
  const leader = await prisma.employee.findUnique({ where: { email: 'huuloi21082004@gmail.com' } });
  if (leader) {
    await prisma.employee.update({ where: { id: leader.id }, data: { role: 'MANAGER' } });
    console.log('✓ huuloi21082004@gmail.com -> MANAGER (leader), mật khẩu = mã NV:', leader.employeeCode?.toLowerCase());
  }

  const total = await prisma.employee.count();
  console.log('Tổng nhân viên:', total);
  await prisma.$disconnect();
  process.exit(0);
})();
