import bcrypt from "bcrypt";
import { storage } from "./storage";
import { log } from "./vite";

/**
 * Seed inicial para garantir que sempre existe pelo menos um usuário master
 * Executa automaticamente no startup do servidor
 */
export async function seedDatabase() {
  try {
    // Verifica se já existem usuários no banco
    const users = await storage.getAllUsers();
    
    if (users.length === 0) {
      log("🌱 Banco de dados vazio detectado. Criando usuário master padrão...");
      
      // Cria senha hash para "Admin@2025"
      const passwordHash = await bcrypt.hash("Admin@2025", 10);
      
      // Cria usuário master padrão
      const masterUser = await storage.createUser({
        name: "Administrador" as string,
        email: "admin@sistema.com" as string,
        passwordHash: passwordHash as string,
        role: "master" as const,
      });
      
      log(`✅ Usuário master criado com sucesso!`);
      log(`📧 Email: admin@sistema.com`);
      log(`🔑 Senha: Admin@2025`);
      log(`⚠️  IMPORTANTE: Altere a senha após o primeiro login!`);
      
      return masterUser;
    } else {
      log(`✅ Banco de dados já possui ${users.length} usuário(s)`);
    }
  } catch (error) {
    console.error("❌ Erro ao executar seed do banco de dados:", error);
    // Não lança erro para não quebrar o startup do servidor
  }
}
