import bcrypt from "bcrypt";
import { storage } from "./storage";
import { log } from "./vite";

export async function seedDatabase() {
  try {
    const adminEmail = "admin@sistema.com";
    const adminPassword = "Admin@2025";
    
    // Check if admin user exists
    const existingAdmin = await storage.getUserByEmail(adminEmail);
    
    if (existingAdmin) {
      // Admin exists, ensure password is correct, user is active, and has master permission
      log("Usuário admin encontrado, verificando...");
      
      // Hash the default password to verify
      const hash = await bcrypt.hash(adminPassword, 10);
      
      // Always update to ensure correct password, active status, and master flag
      // This ensures the seed works even if DB has incorrect state
      await storage.updateUser(existingAdmin.id, {
        passwordHash: hash,
        isActive: true,
        isMaster: true,
        role: "master",
      });
      
      log("Usuário admin atualizado com permissão master!");
    } else {
      // Create new admin user with master permission
      log("Criando usuário master...");
      const hash = await bcrypt.hash(adminPassword, 10);
      
      await storage.createUser({
        name: "Administrador",
        email: adminEmail,
        passwordHash: hash,
        role: "master",
        isMaster: true,
      });
      
      log("Usuário master criado com permissão master!");
    }
  } catch (error) {
    console.error("Erro seed:", error);
  }
}
