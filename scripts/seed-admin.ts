import bcrypt from "bcryptjs";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAIL = "admin@quantaflow.com";
const ADMIN_PASSWORD = "admin123";

async function seedAdmin() {
  console.log("Verificando se usuário admin existe...");
  
  const [existingAdmin] = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existingAdmin) {
    console.log("Usuário admin já existe.");
    return;
  }

  console.log("Criando usuário admin...");
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const [admin] = await db
    .insert(users)
    .values({
      nome: "Administrador",
      email: ADMIN_EMAIL,
      password: hashedPassword,
      tipoUsuario: "admin",
      status: "active",
      mustChangePassword: true,
      tokenVersion: 0,
    })
    .returning();

  console.log("Usuário admin criado com sucesso!");
  console.log(`Email: ${ADMIN_EMAIL}`);
  console.log(`Senha: ${ADMIN_PASSWORD}`);
  console.log("O admin deverá trocar a senha no primeiro login.");
}

seedAdmin()
  .then(() => {
    console.log("Seed concluído.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Erro ao criar admin:", error);
    process.exit(1);
  });
