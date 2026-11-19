import process from "node:process";
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const env = new Map(
  fs
    .existsSync(".env")
    ? fs
      .readFileSync(".env", "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
    : [],
);

// Di container Coolify tidak ada .env: kredensial diambil dari environment.
function nilai(kunci) {
  return env.get(kunci) ?? process.env[kunci];
}

function arg(nama) {
  const item = process.argv.find((a) => a.startsWith(`--${nama}=`));
  return item ? item.slice(nama.length + 3) : null;
}

const email = arg("email");
const name = arg("name");
const password = arg("password");
const role = arg("role") ?? "Petugas Agenda";

if (!email || !name || !password) {
  console.log(
    "Cara pakai: npm run db:user -- --email=nama@magelang.go.id --name=\"Nama Pengguna\" --password=\"kata sandi\" --role=Administrator",
  );
  console.log("Peran: Administrator, Petugas Agenda, Pembaca/Pimpinan");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: nilai("DATABASE_URL") } } });

try {
  const peran = await prisma.roles.findFirst({ where: { name: role } });
  if (!peran) {
    console.log(`Peran ${role} tidak tersedia. Daftar peran dapat dilihat di tabel roles.`);
    process.exitCode = 1;
  } else if (await prisma.users.findFirst({ where: { email: email.toLowerCase() } })) {
    console.log(`Email ${email} sudah terdaftar.`);
    process.exitCode = 1;
  } else {
    const user = await prisma.users.create({
      data: { email: email.toLowerCase(), name, password_hash: await bcrypt.hash(password, 10), role_id: peran.id },
    });
    await prisma.audit_logs.create({
      data: { action: "buat_akun", entity_type: "users", entity_id: user.id, description: `Akun ${name} (${role}) dibuat lewat skrip` },
    });
    console.log(`Akun ${name} (${role}) siap dipakai untuk login.`);
  }
} finally {
  await prisma.$disconnect();
}
