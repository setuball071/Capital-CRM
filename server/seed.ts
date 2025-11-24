import bcrypt from "bcrypt";
import { storage } from "./storage";
import { log } from "./vite";

export async function seedDatabase() {
  try {
    const users = await storage.getAllUsers();
    
    if (users.length === 0) {
      log("Criando usuário master...");
      const hash = await bcrypt.hash("Admin@2025", 10);
      
      await storage.createUser({
        name: "Administrador",
        email: "admin@sistema.com",
        passwordHash: hash,
        role: "master",
      });
      
      log("Usuário master criado!");
    }
  } catch (error) {
    console.error("Erro seed:", error);
  }
}
