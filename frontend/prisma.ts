import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaRevision?: string;
};

// Bump this whenever a migration adds a Prisma delegate used at runtime.
// Next.js development hot reload keeps globalThis alive, so reusing a client
// generated before the migration would otherwise make `tx.notification`
// undefined until the whole dev process is restarted.
const prismaSchemaRevision = "20261018123000-trainer-notifications";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

export const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaSchemaRevision === prismaSchemaRevision
    ? globalForPrisma.prisma
    :
  new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaRevision = prismaSchemaRevision;
}
