import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
    prisma?: PrismaClient;
    pgPool?: Pool;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is missing in .env");
}

// Supabase requiere SSL normalmente
const pool =
    globalForPrisma.pgPool ??
    new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 5,
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.pgPool = pool;

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter: new PrismaPg(pool),
        log: ["error", "warn"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
