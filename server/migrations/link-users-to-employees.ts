import { db } from '../storage';
import { sql } from 'drizzle-orm';

async function migrateUsersToEmployees() {
  console.log('Iniciando migração users → employees...');
  
  try {
    const allUsers = await db.execute(sql`
      SELECT DISTINCT ON (u.id, ut.tenant_id) 
        u.id, ut.tenant_id, u.name, u.email, u.created_at 
      FROM users u
      JOIN user_tenants ut ON u.id = ut.user_id
      WHERE u.is_active = true
    `);
    
    console.log(`Encontrados ${allUsers.rows.length} usuários ativos`);
    
    for (const user of allUsers.rows as any[]) {
      const existingEmployee = await db.execute(sql`
        SELECT id FROM employees WHERE user_id = ${user.id} LIMIT 1
      `);
      
      if (existingEmployee.rows.length > 0) {
        console.log(`User ${user.id} já tem employee vinculado`);
        continue;
      }
      
      const existingByEmail = await db.execute(sql`
        SELECT id FROM employees 
        WHERE email_corporativo = ${user.email} AND tenant_id = ${user.tenant_id}
        LIMIT 1
      `);
      
      if (existingByEmail.rows.length > 0) {
        const empId = (existingByEmail.rows[0] as any).id;
        await db.execute(sql`
          UPDATE employees SET user_id = ${user.id} WHERE id = ${empId}
        `);
        console.log(`✅ Employee ${empId} vinculado ao user ${user.id} (via Email)`);
        continue;
      }
      
      const result = await db.execute(sql`
        INSERT INTO employees (
          tenant_id, user_id, nome_completo, cpf, email_corporativo,
          departamento, cargo, tipo_contrato, data_admissao, status,
          salario_base, criado_por
        ) VALUES (
          ${user.tenant_id}, ${user.id}, ${user.name || 'Nome não informado'},
          ${user.cpf || '00000000000'}, ${user.email},
          'Comercial', 'Vendedor', 'PJ', 
          ${user.created_at ? new Date(user.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]},
          'ativo', 0, ${user.id}
        )
        RETURNING id
      `);
      
      const newId = (result.rows[0] as any).id;
      console.log(`✅ Employee criado para user ${user.id} → employee ${newId}`);
    }
    
    console.log('Migração concluída!');
  } catch (error) {
    console.error('Erro na migração:', error);
    throw error;
  }
}

migrateUsersToEmployees()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
