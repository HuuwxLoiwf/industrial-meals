// Module 2: Quản lý bộ phận (CRUD). Chỉ ADMIN được sửa/xóa.
import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { logAction } from '../lib/audit.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
    res.json(departments);
  })
);

router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const { name, code } = req.body;
    if (!name) return res.status(400).json({ message: 'Thiếu tên bộ phận' });
    const department = await prisma.department.create({
      data: { name, code: code || null },
    });
    await logAction(req, { action: 'DEPARTMENT_CREATE', entity: 'Department', entityId: department.id, detail: department.name });
    res.status(201).json(department);
  })
);

router.put(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy bộ phận' });
    const { name, code } = req.body;
    const department = await prisma.department.update({
      where: { id: req.params.id },
      data: { name, code },
    });
    await logAction(req, { action: 'DEPARTMENT_UPDATE', entity: 'Department', entityId: department.id, detail: department.name });
    res.json(department);
  })
);

// DELETE /api/departments/:id — chặn nếu bộ phận còn nhân viên (kể cả đã vô
// hiệu hóa) để tránh làm mất phòng ban của họ mà không ai để ý. ?force=1 để
// bỏ qua cảnh báo (nhân viên sẽ về "Chưa phân bộ phận" do onDelete: SetNull).
router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const department = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!department) return res.status(404).json({ message: 'Không tìm thấy bộ phận' });

    const employeeCount = await prisma.employee.count({ where: { departmentId: department.id } });
    if (employeeCount > 0 && req.query.force !== '1') {
      return res.status(409).json({
        message: `Bộ phận "${department.name}" đang có ${employeeCount} nhân viên. Xóa sẽ khiến họ về trạng thái "Chưa phân bộ phận".`,
        linkedEmployees: employeeCount,
        requiresForce: true,
      });
    }

    await prisma.department.delete({ where: { id: department.id } });
    await logAction(req, {
      action: 'DEPARTMENT_DELETE',
      entity: 'Department',
      entityId: department.id,
      detail: `${department.name}${employeeCount > 0 ? ` (${employeeCount} NV bị gỡ khỏi phòng ban)` : ''}`,
    });
    res.status(204).end();
  })
);

export default router;
