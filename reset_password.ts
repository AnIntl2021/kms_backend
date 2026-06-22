import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
};

async function reset() {
  let connection;
  try {
    connection = await mysql.createConnection({
      ...dbConfig,
      database: 'kms_master'
    });
    console.log('Connected to kms_master');

    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Update master admin
    const [result]: any = await connection.execute(
      "UPDATE admins SET password = ? WHERE email = 'admin@ansoftt.com'",
      [hashedPassword]
    );

    console.log(`Updated admin@ansoftt.com in kms_master. Rows affected: ${result.affectedRows}`);

    // Update admin in active tenant databases as well if they exist
    const [tenants]: any = await connection.execute('SELECT db_name FROM tenants WHERE status = "Active"');
    for (const tenant of tenants) {
      let tenantConn;
      try {
        tenantConn = await mysql.createConnection({
          ...dbConfig,
          database: tenant.db_name
        });
        const [tResult]: any = await tenantConn.execute(
          "UPDATE admins SET password = ? WHERE email = 'admin@ansoftt.com' OR username = 'admin'",
          [hashedPassword]
        );
        console.log(`Updated admin in tenant DB ${tenant.db_name}. Rows affected: ${tResult.affectedRows}`);
      } catch (err: any) {
        console.error(`Tenant update failed for ${tenant.db_name}:`, err.message);
      } finally {
        if (tenantConn) await tenantConn.end();
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

reset();
