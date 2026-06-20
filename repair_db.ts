import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'kms_master',
};

async function repairDB() {
  let masterPool;
  try {
    masterPool = mysql.createPool(dbConfig);
    console.log('🔄 STARTING COMPREHENSIVE MULTI-TENANT LIVE SYNC...');
    
    // Fetch all tenant databases from master DB
    let tenantDbs: string[] = [];
    try {
      const [tenants]: any = await masterPool.execute('SELECT db_name FROM tenants;');
      tenantDbs = tenants.map((t: any) => t.db_name);
    } catch (e: any) {
      console.log('⚠️ Could not fetch tenants table, repairing master only:', e.message);
    }

    const databases = ['kms_master', ...tenantDbs];
    console.log(`Databases to sync: ${databases.join(', ')}`);

    for (const dbName of databases) {
      console.log(`\n⚙️ Synchronizing database: ${dbName}...`);
      const pool = mysql.createPool({
        ...dbConfig,
        database: dbName
      });

      try {
        await pool.execute('SET FOREIGN_KEY_CHECKS = 0');

        // Utility to add columns if they don't exist
        const addColumnIfNotExist = async (table: string, column: string, definition: string) => {
            try {
                const [columns]: any = await pool.execute(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
                if (columns.length === 0) {
                    console.log(`  + Adding column [${column}] to table [${table}]...`);
                    await pool.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
                }
            } catch (e) {
                console.log(`  - Skipping adding ${column} to ${table}: table might not exist yet.`);
            }
        };

        if (dbName === 'kms_master') {
          // 1. Add subscription columns to tenants table in kms_master
          await addColumnIfNotExist('tenants', 'plan_start_date', 'TIMESTAMP NULL');
          await addColumnIfNotExist('tenants', 'plan_end_date', 'TIMESTAMP NULL');
          await addColumnIfNotExist('tenants', 'base_branches', 'INT DEFAULT 1');
          await addColumnIfNotExist('tenants', 'extra_branches', 'INT DEFAULT 0');
          await addColumnIfNotExist('tenants', 'base_counters', 'INT DEFAULT 1');
          await addColumnIfNotExist('tenants', 'extra_counters', 'INT DEFAULT 0');
          await addColumnIfNotExist('tenants', 'base_users', 'INT DEFAULT 3');
          await addColumnIfNotExist('tenants', 'extra_users', 'INT DEFAULT 0');
          await addColumnIfNotExist('tenants', 'razorpay_order_id', 'VARCHAR(100) NULL');
          await addColumnIfNotExist('tenants', 'status', "ENUM('Active', 'Expired', 'Suspended') DEFAULT 'Active'");

          // 2. Create tenant_transactions table in kms_master
          await pool.execute(`
            CREATE TABLE IF NOT EXISTS tenant_transactions (
              transaction_id INT AUTO_INCREMENT PRIMARY KEY,
              tenant_id INT NOT NULL,
              payment_type ENUM('base_plan', 'add_branch', 'add_counter', 'add_user') NOT NULL,
              amount DECIMAL(10,3) NOT NULL,
              razorpay_order_id VARCHAR(100) UNIQUE NOT NULL,
              razorpay_payment_id VARCHAR(100) NULL,
              razorpay_signature VARCHAR(255) NULL,
              status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
        } else {
          // 3. Create pos_counters table in tenant databases
          await pool.execute(`
            CREATE TABLE IF NOT EXISTS pos_counters (
              counter_id INT AUTO_INCREMENT PRIMARY KEY,
              branch_id INT NOT NULL,
              name VARCHAR(255) NOT NULL,
              status ENUM('active', 'inactive') DEFAULT 'active',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              deleted_at TIMESTAMP NULL,
              FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);

          // 4. Create pos_counter_sessions table in tenant databases
          await pool.execute(`
            CREATE TABLE IF NOT EXISTS pos_counter_sessions (
              session_id INT AUTO_INCREMENT PRIMARY KEY,
              counter_id INT NOT NULL,
              branch_id INT NOT NULL,
              opened_by INT NOT NULL,
              opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              opening_balance DECIMAL(10,3) DEFAULT 0.000,
              closed_by INT NULL,
              closed_at TIMESTAMP NULL,
              closing_balance DECIMAL(10,3) NULL,
              status ENUM('open', 'closed') DEFAULT 'open',
              FOREIGN KEY (counter_id) REFERENCES pos_counters(counter_id),
              FOREIGN KEY (branch_id) REFERENCES branches(branch_id),
              FOREIGN KEY (opened_by) REFERENCES admins(admin_id),
              FOREIGN KEY (closed_by) REFERENCES admins(admin_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);

          await addColumnIfNotExist('sales_orders', 'counter_id', 'INT NULL');
        }

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
        } catch (e) {
            // Safe to ignore
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

        // 4. Ensuring Batch Tracking and POS/B2B columns in sales_orders
        await addColumnIfNotExist('sales_orders', 'vendor_id', 'INT NULL AFTER branch_id');
        await addColumnIfNotExist('sales_orders', 'salesman_id', 'INT NULL AFTER admin_id');
        await addColumnIfNotExist('sales_orders', 'batch_number', 'VARCHAR(100) AFTER admin_id');
        await addColumnIfNotExist('sales_orders', 'expiry_date', 'DATE AFTER batch_number');
        await addColumnIfNotExist('sales_orders', 'dispatch_status', "ENUM('pending', 'dispatched', 'in_transit', 'delivered', 'returned', 'cancelled') DEFAULT 'pending' AFTER expiry_date");
        await addColumnIfNotExist('sales_orders', 'branch_id', "INT NULL");

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
          console.log('  + Seeding default system settings...');
          await pool.execute(`
            INSERT INTO system_settings (setting_key, setting_value, category) VALUES 
            ('company_name', 'Ansoftt', 'general'),
            ('company_arabic_name', 'أنسوفت', 'general'),
            ('company_address', 'Kuwait City', 'general'),
            ('contact_number', '+965 12345678', 'general'),
            ('company_phone', '+965 12345678', 'general'),
            ('company_email', 'info@ansoftt.com', 'general'),
            ('currency_code', 'KWD', 'financial'),
            ('currency_symbol', 'د.ك', 'financial'),
            ('currency_decimals', '3', 'financial'),
            ('country_phone_code', '+965', 'general'),
            ('order_prefix', 'ORD-', 'general'),
            ('business_type', 'restaurant_pos', 'general'),
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
        // 8. CREATE sales_return_items
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS sales_return_items (
            return_item_id INT AUTO_INCREMENT PRIMARY KEY,
            return_id INT,
            menu_item_id INT,
            quantity DECIMAL(10,3) NOT NULL,
            unit_price DECIMAL(10,3) NOT NULL,
            expiry_date DATE NULL,
            FOREIGN KEY (return_id) REFERENCES sales_returns(return_id) ON DELETE CASCADE
          ) ENGINE=InnoDB
        `);
        await addColumnIfNotExist('sales_return_items', 'menu_item_id', 'INT NULL AFTER return_id');

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

        // 10. CREATE salesmen table
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS salesmen (
              salesman_id INT AUTO_INCREMENT PRIMARY KEY,
              name_en VARCHAR(255) NOT NULL,
              name_ar VARCHAR(255),
              phone VARCHAR(20),
              email VARCHAR(100),
              commission_rate DECIMAL(5,2) DEFAULT 0.00,
              status ENUM('active', 'inactive') DEFAULT 'active',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              deleted_at TIMESTAMP NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 11. CREATE inventory_batches table
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS inventory_batches (
              batch_id INT AUTO_INCREMENT PRIMARY KEY,
              inventory_item_id INT NOT NULL,
              purchase_id INT DEFAULT NULL,
              original_quantity DECIMAL(15, 3) NOT NULL,
              remaining_quantity DECIMAL(15, 3) NOT NULL,
              cost_per_unit DECIMAL(15, 3) NOT NULL,
              status ENUM('active', 'exhausted') DEFAULT 'active',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id) ON DELETE CASCADE,
              INDEX idx_fifo_lookup (inventory_item_id, status, created_at)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 12. CREATE partner_branches table
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS partner_branches (
              branch_id INT AUTO_INCREMENT PRIMARY KEY,
              partner_id INT NOT NULL,
              name_en VARCHAR(255) NOT NULL,
              name_ar VARCHAR(255) DEFAULT NULL,
              address TEXT DEFAULT NULL,
              contact_person VARCHAR(255) DEFAULT NULL,
              phone VARCHAR(50) DEFAULT NULL,
              status ENUM('active', 'inactive') DEFAULT 'active',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              FOREIGN KEY (partner_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // 13. CREATE operational_expenses table
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS operational_expenses (
              expense_id INT AUTO_INCREMENT PRIMARY KEY,
              type ENUM('Labor Expense', 'Other Expense') NOT NULL,
              category VARCHAR(255) NOT NULL,
              amount DECIMAL(15, 3) NOT NULL,
              expense_date DATE NOT NULL,
              description TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        try {
          await pool.execute(`ALTER TABLE sales_orders ADD CONSTRAINT fk_sales_salesman FOREIGN KEY (salesman_id) REFERENCES salesmen(salesman_id) ON DELETE SET NULL`);
        } catch (e) {
          // Ignore if exists
        }

        // Update Currency to Local Symbol
        await pool.execute("UPDATE system_settings SET setting_value = 'د.ك' WHERE setting_key = 'currency_symbol'");

        // Seed default roles and permissions
        const defaultPerms = JSON.stringify(["dashboard", "inventory", "sales", "accounts", "users", "roles", "assets", "balance-sheet"]);
        await pool.execute(`
          INSERT INTO roles (role_name, display_name_en, display_name_ar, permissions)
          VALUES ('super_admin', 'Super Admin', 'مدير عام', ?)
          ON DUPLICATE KEY UPDATE permissions = COALESCE(permissions, ?)
        `, [defaultPerms, defaultPerms]);
        
        await pool.execute(`
          INSERT INTO roles (role_name, display_name_en, display_name_ar, permissions)
          VALUES ('Admin', 'Admin', 'Admin', ?)
          ON DUPLICATE KEY UPDATE permissions = COALESCE(permissions, ?)
        `, [defaultPerms, defaultPerms]);
        
        console.log(`✅ ${dbName} synchronized successfully.`);
      } catch (err: any) {
        console.error(`❌ Sync failed for database ${dbName}:`, err.message);
      } finally {
        await pool.end();
      }
    }
    console.log('✅ ALL SYSTEMS ONLINE AND SYNCED.');
  } catch (error) {
    console.error('❌ SYNC FAILED:', error);
  } finally {
    if (masterPool) await masterPool.end();
  }
}

repairDB();
