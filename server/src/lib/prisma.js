// Khởi tạo Prisma Client với Neon serverless adapter.
// Adapter cho phép Prisma dùng driver Neon (WebSocket) thay vì TCP truyền thống,
// phù hợp môi trường serverless.
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Neon cần WebSocket constructor khi chạy trong Node.js
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Thiếu biến môi trường DATABASE_URL');
}

const adapter = new PrismaNeon({ connectionString });

// Tránh tạo nhiều instance khi --watch reload trong môi trường dev
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
