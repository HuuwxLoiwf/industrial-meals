// Module 6 (Tổng hợp suất ăn) + Module 7 (Báo cáo thống kê).
// Số liệu = đăng ký cá nhân (MealRegistration) + đăng ký theo lô (BatchRegistration,
// chỉ có SỐ LƯỢNG BÁO TRƯỚC — nhà ăn phát khay trực tiếp không quét mã).
import { Router } from 'express';
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

// Lấy đơn giá suất ăn hiện hành (tạo mặc định nếu chưa cấu hình).
async function getPricing() {
  return prisma.mealPricing.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default' },
  });
}

// MANAGER chỉ được xem số liệu của phòng ban mình -> where filter dùng chung.
function deptScope(req) {
  return req.employee.role === 'MANAGER' ? req.employee.departmentId : undefined;
}

// GET /api/summary/dashboard
router.get(
  '/dashboard',
  requireRole('ADMIN', 'MANAGER', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const today = parseMealDate(todayVNStr());
    const scopeDeptId = deptScope(req);

    const empWhere = { status: 'ACTIVE', ...(scopeDeptId ? { departmentId: scopeDeptId } : {}) };
    const regWhere = {
      mealDate: today,
      status: { not: 'CANCELLED' },
      ...(scopeDeptId ? { employee: { departmentId: scopeDeptId } } : {}),
    };
    const batchWhere = { mealDate: today, ...(scopeDeptId ? { departmentId: scopeDeptId } : {}) };

    const [
      employeeCount,
      departmentCount,
      shiftCount,
      todayRegs,
      recentRegs,
      perShift,
      todayBatches,
      todayBatchesWithDept,
      todayVotes,
    ] = await Promise.all([
      prisma.employee.count({ where: empWhere }),
      scopeDeptId ? Promise.resolve(1) : prisma.department.count(),
      prisma.mealShift.count({ where: { active: true } }),
      prisma.mealRegistration.findMany({ where: regWhere }),
      prisma.mealRegistration.findMany({
        where: scopeDeptId ? { employee: { departmentId: scopeDeptId } } : {},
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: {
          mealShift: true,
          employee: { select: { fullName: true, department: true } },
        },
      }),
      prisma.mealShift.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
      prisma.batchRegistration.findMany({ where: batchWhere }),
      // Cùng dữ liệu lô nhưng kèm tên phòng để dựng thống kê theo phòng ban.
      prisma.batchRegistration.findMany({ where: batchWhere, select: { departmentName: true, qtyStandard: true, qtyAlternative: true } }),
      // Bình chọn món hôm nay (kèm món) để tính top thích/không thích.
      prisma.dishVote.findMany({
        where: { menuDate: today },
        include: { dish: { select: { id: true, name: true } } },
      }),
    ]);

    const batchStd = todayBatches.reduce((s, b) => s + b.qtyStandard, 0);
    const batchAlt = todayBatches.reduce((s, b) => s + b.qtyAlternative, 0);
    const batchOvertimeIntern = todayBatches
      .filter((b) => b.batchType === 'OVERTIME_INTERN')
      .reduce((s, b) => s + b.qtyStandard + b.qtyAlternative, 0);

    const indivStandard = todayRegs.filter((r) => r.mealType === 'STANDARD').length;
    const indivAlternative = todayRegs.length - indivStandard;

    const todayRegistered = todayRegs.length + batchStd + batchAlt;
    const todayStandard = indivStandard + batchStd;
    const todayAlternative = indivAlternative + batchAlt;

    const countByShift = {};
    for (const r of todayRegs) {
      countByShift[r.mealShiftId] = (countByShift[r.mealShiftId] || 0) + 1;
    }
    for (const b of todayBatches) {
      countByShift[b.mealShiftId] =
        (countByShift[b.mealShiftId] || 0) + b.qtyStandard + b.qtyAlternative;
    }
    const shiftChart = perShift.map((s) => ({
      name: s.startTime,
      period: s.period,
      count: countByShift[s.id] || 0,
    }));

    // Thống kê suất ăn hôm nay theo phòng ban (từ lô đã báo) — top nhiều suất nhất trước.
    const deptTotals = {};
    for (const b of todayBatchesWithDept) {
      const name = b.departmentName || 'Chưa phân bộ phận';
      deptTotals[name] = (deptTotals[name] || 0) + b.qtyStandard + b.qtyAlternative;
    }
    const departmentChart = Object.entries(deptTotals)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Top món bình chọn hôm nay (thích - không thích cao nhất).
    const voteByDish = {};
    for (const v of todayVotes) {
      const id = v.dish.id;
      voteByDish[id] ??= { name: v.dish.name, liked: 0, disliked: 0 };
      if (v.liked) voteByDish[id].liked++;
      else voteByDish[id].disliked++;
    }
    const topDishVotes = Object.values(voteByDish)
      .sort((a, b) => (b.liked - b.disliked) - (a.liked - a.disliked))
      .slice(0, 5);

    res.json({
      cards: {
        employees: employeeCount,
        departments: departmentCount,
        shifts: shiftCount,
        todayRegistered,
        todayBatchCount: todayBatches.length,
        todayOvertimeIntern: batchOvertimeIntern,
        todayStandard,
        todayAlternative,
      },
      shiftChart,
      departmentChart,
      topDishVotes,
      recent: recentRegs.map((r) => ({
        id: r.id,
        employee: r.employee.fullName,
        department: r.employee.department?.name || '—',
        shift: `${r.mealShift.startTime}`,
        mealType: r.mealType,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  })
);

// GET /api/summary/daily?date=YYYY-MM-DD
// Tổng hợp theo Bộ phận x Ca ăn cho 1 ngày (gộp cá nhân + lô) — cho nhà ăn chuẩn bị.
// MANAGER chỉ thấy dòng phòng ban của mình.
router.get(
  '/daily',
  requireRole('MANAGER', 'ADMIN', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const date = parseMealDate(req.query.date) || parseMealDate(todayVNStr());
    const scopeDeptId = deptScope(req);

    const [registrations, batches, shifts] = await Promise.all([
      prisma.mealRegistration.findMany({
        where: {
          mealDate: date,
          status: { not: 'CANCELLED' },
          ...(scopeDeptId ? { employee: { departmentId: scopeDeptId } } : {}),
        },
        include: { mealShift: true, employee: { select: { department: true } } },
      }),
      prisma.batchRegistration.findMany({
        where: { mealDate: date, ...(scopeDeptId ? { departmentId: scopeDeptId } : {}) },
        include: { mealShift: true },
      }),
      prisma.mealShift.findMany({ orderBy: { order: 'asc' } }),
    ]);

    const byDepartment = {};
    let totalRegistered = 0;
    let totalStandard = 0;
    let totalAlternative = 0;

    const ensureDept = (name) => {
      if (!byDepartment[name]) {
        byDepartment[name] = { department: name, shifts: {}, total: 0 };
      }
      return byDepartment[name];
    };
    const ensureCell = (dep, shiftId) => (dep.shifts[shiftId] ??= { registered: 0 });

    for (const r of registrations) {
      const depName = r.employee.department?.name || 'Chưa phân bộ phận';
      const dep = ensureDept(depName);
      const cell = ensureCell(dep, r.mealShiftId);
      cell.registered += 1;
      dep.total += 1;
      totalRegistered += 1;
      if (r.mealType === 'ALTERNATIVE') totalAlternative += 1;
      else totalStandard += 1;
    }

    for (const b of batches) {
      const depName = b.departmentName || 'Đăng ký theo lô';
      const dep = ensureDept(depName);
      const cell = ensureCell(dep, b.mealShiftId);
      const qty = b.qtyStandard + b.qtyAlternative;
      cell.registered += qty;
      dep.total += qty;
      totalRegistered += qty;
      totalStandard += b.qtyStandard;
      totalAlternative += b.qtyAlternative;
    }

    res.json({
      date: req.query.date || todayVNStr(),
      shifts,
      rows: Object.values(byDepartment).sort((a, b) => a.department.localeCompare(b.department)),
      totals: {
        registered: totalRegistered,
        standard: totalStandard,
        alternative: totalAlternative,
      },
    });
  })
);

// GET /api/summary/by-department?date=YYYY-MM-DD
router.get(
  '/by-department',
  requireRole('ADMIN', 'MANAGER', 'CANTEEN'),
  asyncHandler(async (req, res) => {
    const date = parseMealDate(req.query.date) || parseMealDate(todayVNStr());

    const empWhere = { status: 'ACTIVE' };
    if (req.employee.role === 'MANAGER') empWhere.departmentId = req.employee.departmentId;

    const [employees, regs] = await Promise.all([
      prisma.employee.findMany({
        where: empWhere,
        include: { department: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.mealRegistration.findMany({
        where: { mealDate: date, status: { not: 'CANCELLED' } },
        include: { mealShift: true },
      }),
    ]);

    const regByEmp = new Map();
    for (const r of regs) regByEmp.set(r.employeeId, r);

    const byDept = new Map();
    for (const e of employees) {
      const key = e.department?.id || '__none__';
      const name = e.department?.name || 'Chưa phân bộ phận';
      if (!byDept.has(key)) {
        byDept.set(key, { departmentId: e.department?.id || null, department: name, members: [] });
      }
      const reg = regByEmp.get(e.id);
      byDept.get(key).members.push({
        id: e.id,
        fullName: e.fullName,
        employeeCode: e.employeeCode,
        email: e.email,
        registered: !!reg,
        shift: reg?.mealShift ? `${reg.mealShift.startTime} - ${reg.mealShift.endTime}` : null,
        mealType: reg?.mealType || null,
      });
    }

    const departments = [...byDept.values()]
      .map((d) => ({
        ...d,
        employeeCount: d.members.length,
        registeredCount: d.members.filter((m) => m.registered).length,
      }))
      .sort((a, b) => a.department.localeCompare(b.department));

    res.json({
      date: req.query.date || todayVNStr(),
      departments,
      totals: {
        employees: employees.length,
        registered: departments.reduce((s, d) => s + d.registeredCount, 0),
      },
    });
  })
);

// GET /api/summary/pricing - xem đơn giá suất ăn hiện hành.
router.get(
  '/pricing',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    res.json(await getPricing());
  })
);

// PUT /api/summary/pricing - cập nhật đơn giá. Chỉ ADMIN.
router.put(
  '/pricing',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const priceStandard = Math.max(0, parseInt(req.body.priceStandard, 10) || 0);
    const priceAlternative = Math.max(0, parseInt(req.body.priceAlternative, 10) || 0);
    const pricing = await prisma.mealPricing.upsert({
      where: { id: 'default' },
      update: { priceStandard, priceAlternative },
      create: { id: 'default', priceStandard, priceAlternative },
    });
    res.json(pricing);
  })
);

// GET /api/summary/monthly?month=YYYY-MM  (gộp cá nhân + lô)
// MANAGER chỉ thấy chi phí/số liệu của phòng ban mình.
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
    const ensureDay = (day) => (byDay[day] ??= { date: day, registered: 0, standard: 0, alternative: 0 });

    for (const r of registrations) {
      const day = r.mealDate.toISOString().slice(0, 10);
      const d = ensureDay(day);
      d.registered += 1;
      if (r.mealType === 'ALTERNATIVE') d.alternative += 1;
      else d.standard += 1;
    }
    for (const b of batches) {
      const day = b.mealDate.toISOString().slice(0, 10);
      const d = ensureDay(day);
      d.registered += b.qtyStandard + b.qtyAlternative;
      d.standard += b.qtyStandard;
      d.alternative += b.qtyAlternative;
    }

    const days = Object.values(byDay)
      .map((d) => ({
        ...d,
        received: d.registered, // lô không quét mã -> giả định phát đủ theo báo trước
        cost: d.standard * pricing.priceStandard + d.alternative * pricing.priceAlternative,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalRegistered = days.reduce((s, d) => s + d.registered, 0);
    const totalStandard = days.reduce((s, d) => s + d.standard, 0);
    const totalAlternative = days.reduce((s, d) => s + d.alternative, 0);
    const totalCost = days.reduce((s, d) => s + d.cost, 0);

    res.json({
      month,
      pricing: { priceStandard: pricing.priceStandard, priceAlternative: pricing.priceAlternative },
      days,
      totals: {
        registered: totalRegistered,
        received: totalRegistered,
        standard: totalStandard,
        alternative: totalAlternative,
        estimatedCost: totalCost,
      },
    });
  })
);

// GET /api/summary/analytics?month=YYYY-MM
// Thống kê nâng cao: món phổ biến, số suất tăng ca TTS theo ngày.
// MANAGER chỉ thấy số liệu phòng ban mình (món phổ biến vẫn toàn công ty vì
// thực đơn dùng chung, không thuộc riêng phòng ban nào).
router.get(
  '/analytics',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const month = req.query.month || monthVNStr();
    const scopeDeptId = deptScope(req);
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const [registrations, batches, topDishes] = await Promise.all([
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
      prisma.menuItem.findMany({
        where: { menu: { menuDate: { gte: start, lt: end } } },
        include: { dish: true },
      }),
    ]);

    const indivReg = registrations.length;
    const batchReg = batches.reduce((s, b) => s + b.qtyStandard + b.qtyAlternative, 0);
    const overtimeInternReg = batches
      .filter((b) => b.batchType === 'OVERTIME_INTERN')
      .reduce((s, b) => s + b.qtyStandard + b.qtyAlternative, 0);

    const totalReg = indivReg + batchReg;
    const std =
      registrations.filter((r) => r.mealType === 'STANDARD').length +
      batches.reduce((s, b) => s + b.qtyStandard, 0);
    const alt = totalReg - std;

    const dishCount = {};
    for (const mi of topDishes) {
      const name = mi.dish?.name || 'Không rõ';
      dishCount[name] = (dishCount[name] || 0) + 1;
    }
    const popularDishes = Object.entries(dishCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const overtimeByDay = {};
    for (const b of batches.filter((b) => b.batchType === 'OVERTIME_INTERN')) {
      const day = b.mealDate.toISOString().slice(0, 10);
      overtimeByDay[day] = (overtimeByDay[day] || 0) + b.qtyStandard + b.qtyAlternative;
    }
    const overtimeInternByDay = Object.entries(overtimeByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      month,
      totals: {
        registered: totalReg,
        standard: std,
        alternative: alt,
        overtimeIntern: overtimeInternReg,
      },
      popularDishes,
      overtimeInternByDay,
    });
  })
);

export default router;
