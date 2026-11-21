import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

function getPgPool(): pg.Pool {
  if (!globalForPrisma.pgPool) {
    const dbUrl =
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable";

    globalForPrisma.pgPool = new pg.Pool({
      connectionString: dbUrl,
      max: 20,
      idleTimeoutMillis: 120000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
    });
  }
  return globalForPrisma.pgPool;
}

function createPrismaClient(): PrismaClient {
  const pool = getPgPool();
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
