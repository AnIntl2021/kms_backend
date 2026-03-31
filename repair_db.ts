import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'fresh_n_fast_db',
};

async function repairDB() {
  let pool;
  try {
    pool = mysql.createPool(dbConfig);
    console.log('🔄 STARTING COMPREHENSIVE LIVE SYNC...');
    await pool.execute('SET FOREIGN_KEY_CHECKS = 0');

    // Utility to add columns if they don't exist
    const addColumnIfNotExist = async (table: string, column: string, definition: string) => {
        try {
            const [columns]: any = await pool.execute(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
            if (columns.length === 0) {
                console.log(`+ Adding column [${column}] to table [${table}]...`);
                await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
            }
        } catch (e) {
            console.log(`- Skipping adding ${column} to ${table}: table might not exist yet.`);
        }
    };

    // 1. Repair menu_items (Missing current_stock)
    await addColumnIfNotExist('menu_items', 'current_stock', 'DECIMAL(10,2) DEFAULT 0 AFTER price');

    // 2. CREATE production_logs
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS production_logs (
        production_id INT AUTO_INCREMENT PRIMARY KEY,
        batch_number VARCHAR(100) UNIQUE,
        production_date DATE,
        expiry_date DATE,
        admin_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    console.log('✅ table [production_logs] ready.');

    // 3. CREATE production_items
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS production_items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        production_id INT,
        menu_item_id INT,
        quantity_produced INT NOT NULL,
        FOREIGN KEY (production_id) REFERENCES production_logs(production_id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    console.log('✅ table [production_items] ready.');

    // 4. Ensuring Batch Tracking columns in sales_orders
    await addColumnIfNotExist('sales_orders', 'batch_number', 'VARCHAR(100) AFTER admin_id');
    await addColumnIfNotExist('sales_orders', 'expiry_date', 'DATE AFTER batch_number');

    // 5. CREATE system_settings
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        category VARCHAR(50) DEFAULT 'general',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
    
    // Seed default settings if empty
    const [existingSettings]: any = await pool.execute('SELECT COUNT(*) as count FROM system_settings');
    if (existingSettings[0].count === 0) {
      console.log('+ Seeding default system settings...');
      await pool.execute(`
        INSERT INTO system_settings (setting_key, setting_value, category) VALUES 
        ('company_name', 'Fresh n Fast', 'general'),
        ('company_address', 'Shuwaikh, Kuwait', 'general'),
        ('contact_number', '+965 12345678', 'general'),
        ('currency_symbol', 'KWD', 'financial'),
        ('default_expiry_days', '4', 'production'),
        ('vat_percentage', '0', 'financial')
      `);
    }
    // 6. Repair purchase_orders (Missing date column)
    await addColumnIfNotExist('purchase_orders', 'date', 'DATE AFTER po_number');
    
    console.log('✅ table [system_settings] ready.');

    // 7. Update Currency to Local Symbol
    await pool.execute("UPDATE system_settings SET setting_value = 'د.ك' WHERE setting_key = 'currency_symbol'");
    
    console.log('✅ ALL SYSTEMS ONLINE AND SYNCED.');
  } catch (error) {
    console.error('❌ SYNC FAILED:', error);
  } finally {
    if (pool) await pool.end();
  }
}

repairDB();
