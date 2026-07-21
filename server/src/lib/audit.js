// Helper ghi nhật ký hoạt động (audit log). Không chặn luồng chính nếu lỗi.
import prisma from './prisma.js';

export async function logAction(req, { action, entity, entityId, detail }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: req.employee?.id || null,
        actorName: req.employee?.fullName || null,
        action,
        entity: entity || null,
        entityId: entityId || null,
        detail: detail || null,
      },
    });
  } catch {
    // Bỏ qua lỗi ghi log để không ảnh hưởng nghiệp vụ.
  }
}
