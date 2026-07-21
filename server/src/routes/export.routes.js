// Xuất báo cáo Excel (.xlsx) cho kế toán/nhà ăn đối chiếu.
import { Router } from 'express';
import * as XLSX from 'xlsx';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { todayVNStr, monthVNStr } from '../lib/dates.js';

const router = Router();

function parseMealDate(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function sendWorkbook(res, wb, filename) {
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

async function getPricing() {
  return prisma.mealPricing.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
}

function deptScope(req) {
  return req.employee.role === 'MANAGER' ? req.employee.departmentId : undefined;
}

// GET /api/export/daily?date=YYYY-MM-DD  -> Excel tổng hợp 1 ngày theo bộ phận & ca.
router.get(
  '/daily',
  requireRole('ADMIN', 'MANAGER', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const dateStr = req.query.date || todayVNStr();
    const date = parseMealDate(dateStr);
    const scopeDeptId = deptScope(req);

    const [registrations, batches] = await Promise.all([
      prisma.mealRegistration.findMany({
        where: {
          mealDate: date,
          status: { not: 'CANCELLED' },
          ...(scopeDeptId ? { employee: { departmentId: scopeDeptId } } : {}),
        },
        include: {
          mealShift: true,
          employee: { select: { employeeCode: true, fullName: true, department: true } },
        },
      }),
      prisma.batchRegistration.findMany({
        where: { mealDate: date, ...(scopeDeptId ? { departmentId: scopeDeptId } : {}) },
        include: { mealShift: true, createdBy: { select: { fullName: true } } },
      }),
    ]);

    // Sheet 1: Tổng hợp theo bộ phận x ca.
    const byDept = {};
    const ensure = (name) => (byDept[name] ??= { 'Bộ phận': name });
    const addToCell = (name, shiftName, qty) => {
      const row = ensure(name);
      row[shiftName] = (row[shiftName] || 0) + qty;
      row['Tổng'] = (row['Tổng'] || 0) + qty;
    };
    for (const r of registrations) {
      addToCell(r.employee.department?.name || 'Chưa phân bộ phận', r.mealShift.name, 1);
    }
    for (const b of batches) {
      addToCell(b.departmentName || 'Đăng ký theo lô', b.mealShift.name, b.qtyStandard + b.qtyAlternative);
    }
    const summaryRows = Object.values(byDept);

    // Sheet 2: Chi tiết đăng ký cá nhân.
    const detailRows = registrations.map((r) => ({
      'Mã NV': r.employee.employeeCode,
      'Họ tên': r.employee.fullName,
      'Bộ phận': r.employee.department?.name || '—',
      'Ca': r.mealShift.name,
      'Loại suất': r.mealType === 'ALTERNATIVE' ? 'Cải tiến' : 'Thường',
    }));

    // Sheet 3: Chi tiết lô.
    const batchRows = batches.map((b) => ({
      'Loại': b.batchType === 'OVERTIME_INTERN' ? 'Tăng ca - TTS' : 'Thường',
      'Bộ phận': b.departmentName || '—',
      'Người báo': b.createdBy?.fullName || '—',
      'Ca': b.mealShift.name,
      'Suất thường': b.qtyStandard,
      'Suất cải tiến': b.qtyAlternative,
      'Tổng': b.qtyStandard + b.qtyAlternative,
      'Ghi chú': b.note || '',
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows.length ? summaryRows : [{ 'Bộ phận': 'Không có dữ liệu' }]), 'Tổng hợp');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows.length ? detailRows : [{ 'Mã NV': 'Không có' }]), 'Chi tiết cá nhân');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(batchRows.length ? batchRows : [{ 'Mã lô': 'Không có' }]), 'Chi tiết lô');

    sendWorkbook(res, wb, `bao-cao-ngay-${dateStr}.xlsx`);
  })
);

// GET /api/export/monthly?month=YYYY-MM  -> Excel báo cáo tháng theo ngày (dùng đơn giá đã cấu hình).
router.get(
  '/monthly',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const month = req.query.month || monthVNStr();
    const pricing = await getPricing();
    const scopeDeptId = deptScope(req);
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const [registrations, batches] = await Promise.all([
      prisma.mealRegistration.findMany({
        where: {
          mealDate: { gte: start, lt: end },
          status: { not: 'CANCELLED' },
          ...(scopeDeptId ? { employee: { departmentId: scopeDeptId } } : {}),
        },
      }),
      prisma.batchRegistration.findMany({
        where: {
          mealDate: { gte: start, lt: end },
          ...(scopeDeptId ? { departmentId: scopeDeptId } : {}),
        },
      }),
    ]);

    const byDay = {};
    const ensureDay = (d) => (byDay[d] ??= { Ngày: d, 'Suất thường': 0, 'Suất cải tiến': 0 });
    for (const r of registrations) {
      const d = ensureDay(r.mealDate.toISOString().slice(0, 10));
      if (r.mealType === 'ALTERNATIVE') d['Suất cải tiến'] += 1;
      else d['Suất thường'] += 1;
    }
    for (const b of batches) {
      const d = ensureDay(b.mealDate.toISOString().slice(0, 10));
      d['Suất thường'] += b.qtyStandard;
      d['Suất cải tiến'] += b.qtyAlternative;
    }
    const rows = Object.values(byDay).sort((a, b) => a['Ngày'].localeCompare(b['Ngày']));
    rows.forEach((r) => {
      r['Tổng suất'] = r['Suất thường'] + r['Suất cải tiến'];
      r['Chi phí (VND)'] = r['Suất thường'] * pricing.priceStandard + r['Suất cải tiến'] * pricing.priceAlternative;
    });

    const totalStandard = rows.reduce((s, r) => s + r['Suất thường'], 0);
    const totalAlternative = rows.reduce((s, r) => s + r['Suất cải tiến'], 0);
    const totalCost = rows.reduce((s, r) => s + r['Chi phí (VND)'], 0);
    rows.push({
      Ngày: 'TỔNG',
      'Suất thường': totalStandard,
      'Suất cải tiến': totalAlternative,
      'Tổng suất': totalStandard + totalAlternative,
      'Chi phí (VND)': totalCost,
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `Thang ${month}`);
    sendWorkbook(res, wb, `bao-cao-thang-${month}.xlsx`);
  })
);

// GET /api/export/monthly-by-department?month=YYYY-MM
// Báo cáo chi phí theo TỪNG BỘ PHẬN trong tháng — dùng cho kế toán phân bổ chi phí
// suất ăn về các phòng ban khi quyết toán. MANAGER chỉ xem được phòng ban của mình.
router.get(
  '/monthly-by-department',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const month = req.query.month || monthVNStr();
    const pricing = await getPricing();
    const scopeDeptId = deptScope(req);
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const [registrations, batches] = await Promise.all([
      prisma.mealRegistration.findMany({
        where: {
          mealDate: { gte: start, lt: end },
          status: { not: 'CANCELLED' },
          ...(scopeDeptId ? { employee: { departmentId: scopeDeptId } } : {}),
        },
        include: { employee: { select: { department: true } } },
      }),
      prisma.batchRegistration.findMany({
        where: {
          mealDate: { gte: start, lt: end },
          ...(scopeDeptId ? { departmentId: scopeDeptId } : {}),
        },
      }),
    ]);

    const byDept = {};
    const ensure = (name) => (byDept[name] ??= { 'Bộ phận': name, 'Suất thường': 0, 'Suất cải tiến': 0 });
    for (const r of registrations) {
      const d = ensure(r.employee.department?.name || 'Chưa phân bộ phận');
      if (r.mealType === 'ALTERNATIVE') d['Suất cải tiến'] += 1;
      else d['Suất thường'] += 1;
    }
    for (const b of batches) {
      const d = ensure(b.departmentName || 'Chưa phân bộ phận');
      d['Suất thường'] += b.qtyStandard;
      d['Suất cải tiến'] += b.qtyAlternative;
    }

    const rows = Object.values(byDept).sort((a, b) => a['Bộ phận'].localeCompare(b['Bộ phận']));
    rows.forEach((r) => {
      r['Tổng suất'] = r['Suất thường'] + r['Suất cải tiến'];
      r['Chi phí (VND)'] = r['Suất thường'] * pricing.priceStandard + r['Suất cải tiến'] * pricing.priceAlternative;
    });

    const totalStandard = rows.reduce((s, r) => s + r['Suất thường'], 0);
    const totalAlternative = rows.reduce((s, r) => s + r['Suất cải tiến'], 0);
    const totalCost = rows.reduce((s, r) => s + r['Chi phí (VND)'], 0);
    rows.push({
      'Bộ phận': 'TỔNG CỘNG',
      'Suất thường': totalStandard,
      'Suất cải tiến': totalAlternative,
      'Tổng suất': totalStandard + totalAlternative,
      'Chi phí (VND)': totalCost,
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `Theo BP - Thang ${month}`);
    sendWorkbook(res, wb, `bao-cao-chi-phi-theo-bo-phan-${month}.xlsx`);
  })
);

export default router;
