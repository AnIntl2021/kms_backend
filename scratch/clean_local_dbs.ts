import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: ''
};

async function cleanLocalDbs() {
  console.log('⏳ Starting local database cleanup...');
  const conn = await mysql.createConnection(dbConfig);

  try {
    // 1. Drop and Recreate kms_master
    console.log('🧹 Recreating kms_master...');
    await conn.query('DROP DATABASE IF EXISTS kms_master');
    await conn.query('CREATE DATABASE kms_master CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    
    // 2. Load and Run master_schema.sql on kms_master
    console.log('⏳ Importing master_schema.sql...');
    const masterSchemaPath = path.join(process.cwd(), 'master_schema.sql');
    const masterSchemaSql = fs.readFileSync(masterSchemaPath, 'utf8');
    
    const masterPool = await mysql.createPool({
      ...dbConfig,
      database: 'kms_master',
      multipleStatements: true
    });
    await masterPool.query(masterSchemaSql);
    console.log('✅ kms_master schema built successfully!');

    // 3. Define the tenants to seed back
    const tenantsToRecreate = [
      {
        name: 'pizza',
        dbName: 'kms_tenant_61d06f4f5d39',
        email: 'ganga@pizzashop.com',
        phone: '+965 11112222',
        plan: 'Basic'
      },
      {
        name: 'Ansoftt',
        dbName: 'kms_ansoftt_09f7',
        email: 'ansoftt@kms.com',
        phone: '+965 22223333',
        plan: 'Enterprise'
      },
      {
        name: 'Apple',
        dbName: 'kms_apple_1235',
        email: 'affan@apple.com',
        phone: '+965 33334444',
        plan: 'Pro'
      }
    ];

    // Seed tenants in kms_master
    for (const t of tenantsToRecreate) {
      await masterPool.execute(
        'INSERT INTO tenants (name, contact_email, contact_phone, plan, db_name, status) VALUES (?, ?, ?, ?, ?, ?)',
        [t.name, t.email, t.phone, t.plan, t.dbName, 'Active']
      );
      console.log(`✅ Tenant metadata seeded for: ${t.name}`);
    }

    // 4. Drop, Recreate and Seed each Tenant DB
    const tenantSchemaPath = path.join(process.cwd(), 'schema.sql');
    const tenantSchemaSql = fs.readFileSync(tenantSchemaPath, 'utf8');
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);

    for (const t of tenantsToRecreate) {
      console.log(`🧹 Recreating database '${t.dbName}' for ${t.name}...`);
      await conn.query(`DROP DATABASE IF EXISTS \`${t.dbName}\``);
      await conn.query(`CREATE DATABASE \`${t.dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

      // Run tenant schema
      const tenantPool = await mysql.createPool({
        ...dbConfig,
        database: t.dbName,
        multipleStatements: true
      });
      await tenantPool.query(tenantSchemaSql);

      // Seed Default Tenant Admin user (admin_id will be generated, usually 2 or above since seed file in schema.sql might have some users, but let's see. Wait, schema.sql has no inserted admins in it now except for 'admin' which we'll exclude or delete if needed. Wait, schema.sql has: INSERT IGNORE INTO admins (username, email, password, role_id, first_name) VALUES ('admin', 'admin@ansoftt.com', ...). That is admin_id 1. We'll delete it or update it to be clean)
      await tenantPool.execute('DELETE FROM admins'); // Clear any default master seeds from schema.sql
      await tenantPool.execute(
        'INSERT INTO admins (admin_id, username, email, password, role_id, first_name, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [2, t.name.toLowerCase(), t.email, hashedAdminPassword, 1, t.name + ' Admin', 'active']
      );

      // Seed default settings for the company
      await tenantPool.execute(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES ('company_name', ?), ('receipt_header', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [t.name, t.name]
      );
      
      console.log(`✅ Tenant database '${t.dbName}' provisioned and seeded successfully.`);
      await tenantPool.end();
    }

    await masterPool.end();
    console.log('⭐ Local databases successfully cleaned and rebuilt!');

  } catch (err) {
    console.error('❌ Rebuild failed:', err);
  } finally {
    await conn.end();
  }
}

cleanLocalDbs().catch(console.error);
