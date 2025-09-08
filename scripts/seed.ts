import { prisma } from "../lib/db";
import bcrypt from "bcryptjs";

async function main(){
  const email = "demo@chat.app";
  const passwordHash = await bcrypt.hash("demo1234", 10);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo", passwordHash }
  });
  console.log("Seeded demo user:", email, "password: demo1234");
}

main().finally(()=>process.exit(0));
