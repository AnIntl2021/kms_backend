import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'fresh_n_fast_db',
};

async function repairDB() {
  let pool;
  try {
    pool = mysql.createPool(dbConfig);
    console.log('🔄 STARTING FORCED BATCH SYNC...');

    const addColumnIfNotExist = async (table: string, column: string, definition: string) => {
      const [columns]: any = await pool.execute(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
      if (columns.length === 0) {
        console.log(`+ Adding column [${column}] to table [${table}]...`);
        await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    };

    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Manually Sync production_logs
    await addColumnIfNotExist('production_logs', 'batch_number', "VARCHAR(100) UNIQUE AFTER production_id");
    await addColumnIfNotExist('production_logs', 'production_date', "DATE AFTER batch_number");
    await addColumnIfNotExist('production_logs', 'expiry_date', "DATE AFTER production_date");

    // 2. Ensure production_items exists
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS production_items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        production_id INT,
        menu_item_id INT,
        quantity_produced INT NOT NULL,
        FOREIGN KEY (production_id) REFERENCES production_logs(production_id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await pool.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ DATABASE SCHEMA REPAIRED AND SYNCED.');
  } catch (error) {
    console.error('❌ SYNC FAILED:', error);
  } finally {
    if (pool) await pool.end();
  }
}

repairDB();
