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
        const addColumnIfNotExist = async (table, column, definition) => {
            try {
                const [columns] = await pool.execute(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
                if (columns.length === 0) {
                    console.log(`+ Adding column [${column}] to table [${table}]...`);
                    await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
                }
            }
            catch (e) {
                console.log(`- Skipping adding ${column} to ${table}: table might not exist yet.`);
            }
        };
        // 1. Repair menu_items (Missing current_stock, type, and soft-delete)
        await addColumnIfNotExist('menu_items', 'current_stock', 'DECIMAL(10,2) DEFAULT 0 AFTER price');
        await addColumnIfNotExist('menu_items', 'type', "ENUM('selling', 'premix') DEFAULT 'selling' AFTER current_stock");
        await addColumnIfNotExist('menu_items', 'barcode', "VARCHAR(100) NULL AFTER name_ar");
        await addColumnIfNotExist('menu_items', 'deleted_at', 'TIMESTAMP NULL AFTER image_url');
        // 2. Repair menu_item_ingredients (Missing package_id, sub-assembly support)
        await addColumnIfNotExist('menu_item_ingredients', 'package_id', 'VARCHAR(100) NULL AFTER inventory_item_id');
        await addColumnIfNotExist('menu_item_ingredients', 'sub_menu_item_id', 'INT NULL AFTER package_id');
        try {
            await pool.execute('ALTER TABLE menu_item_ingredients MODIFY COLUMN inventory_item_id INT NULL');
            await pool.execute('ALTER TABLE menu_item_ingredients MODIFY COLUMN package_id VARCHAR(100) NULL');
        }
        catch (e) {
            console.log('Skipping modify columns if already compatible.');
        }
        // 2. CREATE production_logs
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS production_logs (
        production_id INT AUTO_INCREMENT PRIMARY KEY,
        batch_number VARCHAR(100) UNIQUE,
        production_date DATE,
        expiry_date DATE,
        branch_id INT NULL,
        admin_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
        console.log('✅ table [production_logs] ready.');
        await addColumnIfNotExist('production_logs', 'branch_id', 'INT NULL AFTER expiry_date');
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
        await addColumnIfNotExist('sales_orders', 'dispatch_status', "ENUM('pending', 'dispatched', 'in_transit', 'delivered', 'returned') DEFAULT 'pending' AFTER expiry_date");
        await addColumnIfNotExist('sales_orders', 'branch_id', "INT NULL AFTER vendor_id");
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
        const [existingSettings] = await pool.execute('SELECT COUNT(*) as count FROM system_settings');
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
        // 7. CREATE sales_returns
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS sales_returns (
        return_id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NULL,
        vendor_id INT,
        branch_id INT NULL,
        reason VARCHAR(255),
        total_credit_amount DECIMAL(10,3) DEFAULT 0.000,
        admin_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
        console.log('✅ table [sales_returns] ready with branch support.');
        // 8. CREATE sales_return_items
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS sales_return_items (
        return_item_id INT AUTO_INCREMENT PRIMARY KEY,
        return_id INT,
        product_id INT,
        quantity DECIMAL(10,3) NOT NULL,
        unit_price DECIMAL(10,3) NOT NULL,
        expiry_date DATE NULL,
        FOREIGN KEY (return_id) REFERENCES sales_returns(return_id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
        console.log('✅ table [sales_return_items] ready.');
        // 9. CREATE notifications
        await pool.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,
        message TEXT NOT NULL,
        type ENUM('info', 'warning', 'success', 'danger') DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        admin_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);
        console.log('✅ table [notifications] ready.');
        console.log('✅ table [system_settings] ready.');
        // 7. Update Currency to Local Symbol
        await pool.execute("UPDATE system_settings SET setting_value = 'د.ك' WHERE setting_key = 'currency_symbol'");
        console.log('✅ ALL SYSTEMS ONLINE AND SYNCED.');
    }
    catch (error) {
        console.error('❌ SYNC FAILED:', error);
    }
    finally {
        if (pool)
            await pool.end();
    }
}
repairDB();
