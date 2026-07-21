// Import danh sách nhân viên từ file Excel vào DB (chạy trực tiếp, không qua API).
// node scripts/import-employees.cjs [đường-dẫn-file.xlsx]
const XLSX = require('xlsx');
const path = require('path');

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}
function pick(row, keys) {
  for (const k of Object.keys(row)) {
    if (keys.includes(normalizeHeader(k))) {
      const v = row[k];
      return v == null ? '' : String(v).trim();
    }
  }
  return '';
}

(async () => {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const file = process.argv[2] || path.join(__dirname, '..', 'danh-sach-nhan-vien.xlsx');
  const wb = XLSX.readFile(file);

  const rows = [];
  for (const sheetName of wb.SheetNames) {
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
    for (const r of data) rows.push(r);
  }

  const res = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const depts = await prisma.department.findMany();
  const deptByName = new Map(depts.map((d) => [normalizeHeader(d.name), d.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fullName = pick(row, ['ho va ten', 'ho ten', 'ten', 'fullname', 'name']);
    const email = pick(row, ['email', 'mail']).toLowerCase();
    const code = pick(row, ['ma nv', 'ma nhan vien', 'manv', 'code', 'employeecode']);
    const phone = pick(row, ['so dien thoai', 'sdt', 'dien thoai', 'phone']);
    const deptName = pick(row, ['bo phan', 'phong ban', 'department', 'phong']);

    if ((!email && !code) || !fullName) { res.skipped++; continue; }

    let departmentId = null;
    if (deptName) {
      const key = normalizeHeader(deptName);
      if (deptByName.has(key)) departmentId = deptByName.get(key);
      else {
        const created = await prisma.department.create({ data: { name: deptName } });
        deptByName.set(key, created.id);
        departmentId = created.id;
      }
    }

    try {
      const existing = email
        ? await prisma.employee.findUnique({ where: { email } })
        : await prisma.employee.findUnique({ where: { employeeCode: code } });
      if (existing) {
        await prisma.employee.update({
          where: { id: existing.id },
          data: { fullName, phone: phone || existing.phone, departmentId: departmentId ?? existing.departmentId },
        });
        res.updated++;
      } else {
        await prisma.employee.create({
          data: {
            employeeCode: code || `NV-${Date.now().toString().slice(-6)}-${i}`,
            fullName, email: email || null, phone: phone || null,
            role: 'EMPLOYEE', departmentId,
          },
        });
        res.created++;
      }
    } catch (e) {
      res.errors++;
      if (res.errors <= 3) console.log('Lỗi dòng', i + 2, e.message);
    }
  }

  console.log('Kết quả import:', res);
  const total = await prisma.employee.count();
  console.log('Tổng nhân viên trong DB:', total);
  await prisma.$disconnect();
  process.exit(0);
})();
