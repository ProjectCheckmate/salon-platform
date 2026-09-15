import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "akhilsingla304@gmail.com";
  // Password comes ONLY from env var. If not provided, generate a random
  // one-time password and print it once so it can be captured and rotated.
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(12).toString("base64url");

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Platform Admin",
      role: "ADMIN",
      passwordHash,
    },
  });

  console.log(`Admin ready: ${admin.email}`);
  if (!process.env.ADMIN_INITIAL_PASSWORD) {
    console.log(
      `\n⚠️  No ADMIN_INITIAL_PASSWORD was set. Generated one-time password:\n   ${adminPassword}\n   Log in once and change it immediately.\n`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
