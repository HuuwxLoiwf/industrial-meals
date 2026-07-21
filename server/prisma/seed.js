// Seed dữ liệu mẫu: bộ phận, ca ăn (ngày/đêm), món ăn, thực đơn hôm nay, đăng ký.
import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

// Cộng phút vào "HH:MM" -> "HH:MM" (giữ trong 24h).
function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h * 60 + m + mins) % (24 * 60);
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

async function main() {
  console.log('🌱 Bắt đầu seed...');

  // 1. Bộ phận
  const departmentNames = [
    { name: 'IT', code: 'IT' },
    { name: 'Kế toán', code: 'ACC' },
    { name: 'Sản xuất A', code: 'SXA' },
    { name: 'Sản xuất B', code: 'SXB' },
    { name: 'QA', code: 'QA' },
    { name: 'Nhân sự', code: 'HR' },
  ];
  const departments = {};
  for (const d of departmentNames) {
    departments[d.name] = await prisma.department.upsert({
      where: { name: d.name },
      update: {},
      create: d,
    });
  }
  console.log(`  ✓ ${Object.keys(departments).length} bộ phận`);

  // 2. Ca ăn: ca NGÀY (40') và ca ĐÊM (45'), mỗi loại 3 khung giờ.
  const dayStarts = ['11:30', '12:00', '12:25'];
  const nightStarts = ['23:30', '00:00', '00:25'];
  const shiftData = [
    ...dayStarts.map((t, i) => ({
      name: `Ca ngày ${t}`,
      period: 'DAY',
      startTime: t,
      endTime: addMinutes(t, 40),
      durationMin: 40,
      order: i + 1,
    })),
    ...nightStarts.map((t, i) => ({
      name: `Ca đêm ${t}`,
      period: 'NIGHT',
      startTime: t,
      endTime: addMinutes(t, 45),
      durationMin: 45,
      order: i + 4,
    })),
  ];
  const shifts = [];
  for (const s of shiftData) {
    shifts.push(
      await prisma.mealShift.upsert({
        where: { name: s.name },
        update: { ...s },
        create: s,
      })
    );
  }
  console.log(`  ✓ ${shifts.length} ca ăn (3 ngày + 3 đêm)`);

  // 3. Món ăn mẫu (có thể gắn imageUrl sau khi upload).
  const dishData = [
    { name: 'Thịt kho trứng', category: 'MAIN' },
    { name: 'Cá chiên sốt cà', category: 'MAIN' },
    { name: 'Sườn xào chua ngọt', category: 'MAIN' },
    { name: 'Gà kho gừng', category: 'MAIN' },
    { name: 'Canh chua cá', category: 'SIDE' },
    { name: 'Rau muống xào tỏi', category: 'SIDE' },
    { name: 'Chuối', category: 'DESSERT' },
    { name: 'Sữa chua', category: 'DESSERT' },
    { name: 'Bún bò Huế', category: 'ALTERNATIVE' },
    { name: 'Miến gà', category: 'ALTERNATIVE' },
  ];
  const dishes = {};
  for (const d of dishData) {
    // Dish không có unique name nên tìm thủ công để tránh trùng khi seed lại.
    let dish = await prisma.dish.findFirst({ where: { name: d.name } });
    if (!dish) dish = await prisma.dish.create({ data: d });
    dishes[d.name] = dish;
  }
  console.log(`  ✓ ${Object.keys(dishes).length} món ăn`);

  // 4. Thực đơn hôm nay: 2 món chính + món phụ + tráng miệng + món cải tiến.
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const menuDishes = [
    'Thịt kho trứng',
    'Cá chiên sốt cà',
    'Rau muống xào tỏi',
    'Chuối',
    'Bún bò Huế',
  ];
  const menu = await prisma.dailyMenu.upsert({
    where: { menuDate: today },
    update: {},
    create: { menuDate: today, note: 'Thực đơn mẫu' },
  });
  for (const name of menuDishes) {
    await prisma.menuItem.upsert({
      where: { menuId_dishId: { menuId: menu.id, dishId: dishes[name].id } },
      update: {},
      create: { menuId: menu.id, dishId: dishes[name].id },
    });
  }
  console.log(`  ✓ Thực đơn hôm nay (${menuDishes.length} món)`);

  // 5. Nhân viên mẫu (chưa gắn Clerk).
  const employeeData = [
    { employeeCode: 'NV001', fullName: 'Nguyễn Văn Admin', role: 'ADMIN', dep: 'IT' },
    { employeeCode: 'NV002', fullName: 'Trần Thị Quản Lý', role: 'MANAGER', dep: 'Sản xuất A' },
    { employeeCode: 'NV003', fullName: 'Lê Văn Bếp', role: 'CANTEEN', dep: null },
    { employeeCode: 'NV004', fullName: 'Phạm Văn A', role: 'EMPLOYEE', dep: 'Sản xuất A' },
    { employeeCode: 'NV005', fullName: 'Hoàng Thị B', role: 'EMPLOYEE', dep: 'Sản xuất A' },
    { employeeCode: 'NV006', fullName: 'Đỗ Văn C', role: 'EMPLOYEE', dep: 'IT' },
    { employeeCode: 'NV007', fullName: 'Vũ Thị D', role: 'EMPLOYEE', dep: 'QA' },
  ];
  const employees = [];
  for (const e of employeeData) {
    employees.push(
      await prisma.employee.upsert({
        where: { employeeCode: e.employeeCode },
        update: {},
        create: {
          employeeCode: e.employeeCode,
          fullName: e.fullName,
          role: e.role,
          departmentId: e.dep ? departments[e.dep].id : null,
        },
      })
    );
  }
  console.log(`  ✓ ${employees.length} nhân viên`);

  // 6. Đăng ký mẫu cho ca ngày 11h30 hôm nay.
  const firstDayShift = shifts.find((s) => s.period === 'DAY');
  const lunchEmployees = employees.filter((e) => e.role === 'EMPLOYEE');
  for (const [i, emp] of lunchEmployees.entries()) {
    await prisma.mealRegistration.upsert({
      where: {
        employeeId_mealShiftId_mealDate: {
          employeeId: emp.id,
          mealShiftId: firstDayShift.id,
          mealDate: today,
        },
      },
      update: {},
      create: {
        employeeId: emp.id,
        mealShiftId: firstDayShift.id,
        mealDate: today,
        // Một vài người chọn suất cải tiến để demo báo cáo.
        mealType: i % 3 === 0 ? 'ALTERNATIVE' : 'STANDARD',
        status: 'APPROVED',
      },
    });
  }
  console.log(`  ✓ ${lunchEmployees.length} đăng ký ca ngày 11h30 hôm nay`);

  console.log('✅ Seed hoàn tất.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
