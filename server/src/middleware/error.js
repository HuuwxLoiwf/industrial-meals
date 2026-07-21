// Xử lý lỗi tập trung.
import { Prisma } from '@prisma/client';

export function notFound(req, res) {
  res.status(404).json({ message: `Không tìm thấy route: ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      // Dịch tên trường bị trùng sang thông báo dễ hiểu.
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target || '');
      const FIELD_LABEL = {
        email: 'Email',
        employee_code: 'Mã nhân viên',
        name: 'Tên',
        code: 'Mã',
        checkin_code: 'Mã check-in',
      };
      const label = Object.keys(FIELD_LABEL).find((k) => target.includes(k));
      const msg = label
        ? `${FIELD_LABEL[label]} này đã tồn tại. Vui lòng dùng giá trị khác.`
        : 'Dữ liệu đã tồn tại (trùng khóa duy nhất).';
      return res.status(409).json({ message: msg, target: err.meta?.target });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ message: 'Không thể thao tác vì dữ liệu đang được tham chiếu ở nơi khác.' });
    }
  }

  res.status(err.status || 500).json({
    message: err.message || 'Lỗi máy chủ',
  });
}
