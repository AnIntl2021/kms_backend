import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

async function migrate() {
  const masterConnection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: 'kms_master'
  });

  const [tenants] = await masterConnection.execute('SELECT db_name FROM tenants;');
  const dbs = ['kms_master', ...tenants.map(t => t.db_name)];

  for (const dbName of dbs) {
    console.log(`Migrating database ${dbName}...`);
    try {
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: dbName
      });

      // 1. Create pos_addons table if it doesn't exist
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS pos_addons (
          addon_id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          price DECIMAL(10,3) NOT NULL DEFAULT 0.000,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_addon_name (name)
        ) ENGINE=InnoDB;
      `);
      console.log(`  Created/verified table pos_addons in ${dbName}`);

      // 2. Add notes column to sales_order_items if it doesn't exist
      try {
        const [notesCols] = await conn.execute(`SHOW COLUMNS FROM sales_order_items LIKE 'notes'`);
        if (notesCols.length === 0) {
          await conn.execute(`ALTER TABLE sales_order_items ADD COLUMN notes VARCHAR(255) NULL DEFAULT NULL`);
          console.log(`  Added notes column to sales_order_items in ${dbName}`);
        } else {
          console.log(`  notes column already exists in sales_order_items in ${dbName}`);
        }
      } catch (e) {
        console.error(`  Failed to add notes in ${dbName}:`, e.message);
      }

      // 3. Add addons column to sales_order_items if it doesn't exist
      try {
        const [addonsCols] = await conn.execute(`SHOW COLUMNS FROM sales_order_items LIKE 'addons'`);
        if (addonsCols.length === 0) {
          await conn.execute(`ALTER TABLE sales_order_items ADD COLUMN addons TEXT NULL DEFAULT NULL`);
          console.log(`  Added addons column to sales_order_items in ${dbName}`);
        } else {
          console.log(`  addons column already exists in sales_order_items in ${dbName}`);
        }
      } catch (e) {
        console.error(`  Failed to add addons in ${dbName}:`, e.message);
      }

      await conn.end();
    } catch (e) {
      console.error(`Could not connect to or process ${dbName}:`, e.message);
    }
  }

  await masterConnection.end();
}

migrate().catch(console.error);
