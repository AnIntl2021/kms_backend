const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Simple simulation of login logic
async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master'
  });

  const username = 'ganga@hardees.com';

  try {
    // 1. Search tenants
    const [allTenants] = await connection.execute('SELECT db_name FROM tenants WHERE status = "Active"');
    let foundDb = null;
    
    for (const tenant of allTenants) {
      try {
        const tenantConn = await mysql.createConnection({
          host: 'localhost',
          user: 'root',
          password: '',
          database: tenant.db_name
        });
        const [checkUser] = await tenantConn.execute(
          `SELECT admin_id FROM admins WHERE (username = ? OR email = ?) AND deleted_at IS NULL AND status = 'active'`,
          [username, username]
        );
        if (checkUser && checkUser.length > 0) {
          foundDb = tenant.db_name;
          await tenantConn.end();
          break;
        }
        await tenantConn.end();
      } catch (err) {
        console.log("Error checking tenant:", tenant.db_name, err.message);
      }
    }

    console.log("Found target DB:", foundDb);

    if (foundDb) {
      const tenantConn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: foundDb
      });

      const [rows] = await tenantConn.execute(
        `SELECT a.*, r.role_name, r.permissions 
         FROM admins a 
         LEFT JOIN roles r ON a.role_id = r.role_id 
         WHERE (a.username = ? OR a.email = ?) AND a.deleted_at IS NULL AND a.status = 'active'`,
        [username, username]
      );

      if (rows.length > 0) {
        const admin = rows[0];
        console.log("Admin details from database:", {
          admin_id: admin.admin_id,
          username: admin.username,
          email: admin.email,
          role_name: admin.role_name,
          permissions: admin.permissions,
          brand_id: admin.brand_id,
          branch_id: admin.branch_id
        });

        // Let's decode how JWT payload is constructed in backend
        const payload = {
          admin_id: admin.admin_id, 
          username: admin.username, 
          role: admin.role_name || (admin.admin_id === 1 ? 'tenant_admin' : 'user'),
          permissions: typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : (admin.permissions || []),
          tenant_db: foundDb,
          brand_id: admin.brand_id,
          branch_id: admin.branch_id
        };
        console.log("Constructed JWT Payload:", payload);
      }
      await tenantConn.end();
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

main();
