import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

const del = await prisma.mealShift.deleteMany({
  where: { name: { in: ['Sáng', 'Trưa', 'Tối', 'Tăng ca'] } },
});
console.log('Đã xóa ca cũ:', del.count);
await prisma.$disconnect();
