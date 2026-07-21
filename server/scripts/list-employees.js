import prisma from '../src/lib/prisma.js';

const emps = await prisma.employee.findMany({
  select: { id: true, clerkUserId: true, email: true, fullName: true, role: true, status: true },
});
console.log(JSON.stringify(emps, null, 2));
await prisma.$disconnect();
