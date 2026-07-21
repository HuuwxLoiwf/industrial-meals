// Bọc handler async để tự động chuyển lỗi sang errorHandler (Express 5 hỗ trợ
// promise rejection nhưng wrapper giúp code đồng nhất & rõ ràng).
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
