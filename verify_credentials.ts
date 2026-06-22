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

async function verify() {
  let connection;
  try {
    connection = await mysql.createConnection({
      ...dbConfig,
      database: 'kms_master'
    });
    console.log('Connected to kms_master');

    // 1. Get all active tenants
    const [tenants]: any = await connection.execute('SELECT name, db_name, status FROM tenants');
    console.log('Tenants in master:', tenants);

    const databases = ['kms_master', ...tenants.map((t: any) => t.db_name)];

    for (const dbName of databases) {
      console.log(`\n--- Checking Admins in Database: ${dbName} ---`);
      let dbConn;
      try {
        dbConn = await mysql.createConnection({
          ...dbConfig,
          database: dbName
        });

        const [admins]: any = await dbConn.execute(
          'SELECT admin_id, username, email, password, status, deleted_at FROM admins'
        );

        for (const admin of admins) {
          const isMatch = await bcrypt.compare('password', admin.password);
          console.log(`User: ${admin.username} (${admin.email})`);
          console.log(`  - Status: ${admin.status}`);
          console.log(`  - Deleted At: ${admin.deleted_at}`);
          console.log(`  - Password 'password' matches: ${isMatch}`);
        }
      } catch (err: any) {
        console.error(`Failed to read admins from ${dbName}:`, err.message);
      } finally {
        if (dbConn) await dbConn.end();
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

verify();
