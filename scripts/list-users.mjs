import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

const users = await prisma.user.findMany({
  orderBy: { createdAt: "asc" },
  select: {
    id: true,
    clerkUserId: true,
    email: true,
    name: true,
    createdAt: true,
    updatedAt: true,
  },
});

console.log(`users: ${users.length}`);
for (const user of users) {
  console.log(
    `${user.email} | ${user.name ?? "(no name)"} | clerkUserId=${user.clerkUserId} | created=${user.createdAt.toISOString()}`,
  );
}

await prisma.$disconnect();
