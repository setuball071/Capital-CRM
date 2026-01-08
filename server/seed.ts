import bcrypt from "bcrypt";
import { storage } from "./storage";
import { log } from "./vite";
import { db } from "./storage";
import { nomenclaturas, userPermissions } from "@shared/schema";
import { eq, and, or, inArray } from "drizzle-orm";

// Module migration mapping: old module name -> new module name
const MODULE_MIGRATION_MAP: Record<string, string> = {
  modulo_compra_lista: "modulo_base_clientes",
  modulo_crm_vendas_campanhas: "modulo_alpha",
  modulo_crm_vendas_atendimento: "modulo_alpha",
  modulo_config_precos: "modulo_config_usuarios",
  modulo_crm_admin: "modulo_alpha",
  modulo_crm: "modulo_alpha",
};

// Lista de bancos brasileiros válidos para seed
const BANCOS_BRASILEIROS = [
  { codigo: "001", nome: "BANCO DO BRASIL" },
  { codigo: "033", nome: "BANCO SANTANDER" },
  { codigo: "104", nome: "CAIXA ECONOMICA FEDERAL" },
  { codigo: "237", nome: "BANCO BRADESCO" },
  { codigo: "341", nome: "BANCO ITAU" },
  { codigo: "318", nome: "BANCO BMG" },
  { codigo: "623", nome: "BANCO PAN" },
  { codigo: "626", nome: "BANCO FIBRA" },
  { codigo: "643", nome: "BANCO PINE" },
  { codigo: "707", nome: "BANCO DAYCOVAL" },
  { codigo: "739", nome: "BANCO CETELEM" },
  { codigo: "756", nome: "SICOOB" },
  { codigo: "748", nome: "SICREDI" },
  { codigo: "389", nome: "BANCO MERCANTIL DO BRASIL" },
  { codigo: "422", nome: "BANCO SAFRA" },
  { codigo: "655", nome: "BANCO VOTORANTIM" },
  { codigo: "077", nome: "BANCO INTER" },
  { codigo: "336", nome: "C6 BANK" },
  { codigo: "260", nome: "NUBANK" },
  { codigo: "212", nome: "BANCO ORIGINAL" },
  { codigo: "208", nome: "BTG PACTUAL" },
  { codigo: "746", nome: "BANCO MODAL" },
  { codigo: "654", nome: "BANCO DIGIMAIS" },
  { codigo: "335", nome: "BANCO DIGIO" },
  { codigo: "394", nome: "BANCO ALFA" },
  { codigo: "121", nome: "AGIBANK" },
  { codigo: "070", nome: "BRB" },
  { codigo: "041", nome: "BANRISUL" },
  { codigo: "004", nome: "BNB" },
  { codigo: "037", nome: "BANPARA" },
  { codigo: "021", nome: "BANESTES" },
  { codigo: "479", nome: "BANCO ITAUBANK" },
  { codigo: "218", nome: "BANCO BONSUCESSO" },
  { codigo: "024", nome: "BANCO BANDEPE" },
  { codigo: "213", nome: "BANCO ARBI" },
  { codigo: "330", nome: "BANCO BARI" },
  { codigo: "246", nome: "BANCO ABC BRASIL" },
  { codigo: "652", nome: "BANCO INDUSTRIAL DO BRASIL" },
  { codigo: "604", nome: "BANCO INDUSTRIAL" },
  { codigo: "633", nome: "BANCO RENDIMENTO" },
  { codigo: "630", nome: "BANCO SOFISA" },
  { codigo: "634", nome: "BANCO TRIANGULO" },
  { codigo: "611", nome: "BANCO PARANA" },
  { codigo: "320", nome: "BANCO CCB BRASIL" },
  { codigo: "329", nome: "ICATU" },
  { codigo: "712", nome: "BANCO OURINVEST" },
  { codigo: "380", nome: "PICPAY" },
  { codigo: "323", nome: "MERCADO PAGO" },
  { codigo: "290", nome: "PAGBANK" },
  { codigo: "197", nome: "STONE" },
  { codigo: "743", nome: "BANCO SEMEAR" },
  { codigo: "349", nome: "FACTA FINANCEIRA" },
  { codigo: "243", nome: "BANCO MASTER" },
  { codigo: "741", nome: "BANCO RIBEIRAO PRETO" },
  { codigo: "184", nome: "BANCO ITAU BBA" },
  { codigo: "755", nome: "BANK OF AMERICA" },
  { codigo: "069", nome: "CREFISA" },
  { codigo: "321", nome: "CREDITAS" },
  { codigo: "280", nome: "WILL BANK" },
  { codigo: "536", nome: "NEON" },
];

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
    
    // Seed de bancos na tabela de nomenclaturas
    await seedBancos();
    
    // Migrate old module permissions to new structure
    await migrateModulePermissions();
    
  } catch (error) {
    console.error("Erro seed:", error);
  }
}

// Migrate old module permissions to new module structure
async function migrateModulePermissions() {
  try {
    const oldModules = Object.keys(MODULE_MIGRATION_MAP);
    
    // Find all permissions with old module names
    const oldPermissions = await db.select()
      .from(userPermissions)
      .where(inArray(userPermissions.module, oldModules));
    
    if (oldPermissions.length === 0) {
      return;
    }
    
    log(`Migrando ${oldPermissions.length} permissões de módulos antigos...`);
    
    for (const perm of oldPermissions) {
      const newModule = MODULE_MIGRATION_MAP[perm.module];
      if (!newModule) continue;
      
      // Check if user already has permission for new module
      const [existing] = await db.select()
        .from(userPermissions)
        .where(and(
          eq(userPermissions.userId, perm.userId),
          eq(userPermissions.module, newModule)
        ));
      
      if (existing) {
        // Merge permissions (OR the flags)
        await db.update(userPermissions)
          .set({
            canView: existing.canView || perm.canView,
            canEdit: existing.canEdit || perm.canEdit,
            canDelegate: existing.canDelegate || perm.canDelegate,
          })
          .where(eq(userPermissions.id, existing.id));
      } else {
        // Create new permission with new module name
        await db.insert(userPermissions)
          .values({
            userId: perm.userId,
            module: newModule,
            canView: perm.canView,
            canEdit: perm.canEdit,
            canDelegate: perm.canDelegate,
          })
          .onConflictDoNothing();
      }
      
      // Delete old permission
      await db.delete(userPermissions)
        .where(eq(userPermissions.id, perm.id));
    }
    
    log(`Migração de permissões concluída.`);
  } catch (error) {
    console.error("Erro ao migrar permissões:", error);
  }
}

async function seedBancos() {
  try {
    // Verifica se já existem bancos cadastrados
    const existingBancos = await db.select()
      .from(nomenclaturas)
      .where(eq(nomenclaturas.categoria, "BANCO"))
      .limit(1);
    
    if (existingBancos.length > 0) {
      // Já existem bancos, não precisa fazer seed
      return;
    }
    
    log("Inserindo nomenclaturas de bancos...");
    
    // Insere todos os bancos
    for (const banco of BANCOS_BRASILEIROS) {
      await db.insert(nomenclaturas)
        .values({
          categoria: "BANCO",
          codigo: banco.codigo,
          nome: banco.nome,
          ativo: true,
        })
        .onConflictDoNothing();
    }
    
    log(`${BANCOS_BRASILEIROS.length} bancos inseridos na tabela de nomenclaturas.`);
  } catch (error) {
    console.error("Erro ao inserir bancos:", error);
  }
}
