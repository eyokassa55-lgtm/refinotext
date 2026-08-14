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

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.log("Connected to Neon.");

  const clerkUserId = `verify_${Date.now()}`;

  const created = await prisma.user.create({
    data: {
      clerkUserId,
      email: "verify@refinotext.local",
      name: "Connection Check",
    },
  });
  console.log("Created user:", created.id, created.clerkUserId);

  const found = await prisma.user.findUnique({
    where: { clerkUserId },
  });

  if (!found || found.id !== created.id) {
    throw new Error("findUnique did not return the created user");
  }
  console.log("Found user by clerkUserId:", found.email);

  await prisma.user.delete({ where: { id: created.id } });
  console.log("Removed verification user.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
