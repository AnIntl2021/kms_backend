import pool from './src/config/db.js';
import bcrypt from 'bcryptjs';

async function repairDB() {
  try {
    console.log('--- 🚀 Elite Database Repair & Synchronization Initialized ---');
    
    // 1. ROLES TABLE
    console.log('Checking roles table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        role_id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL UNIQUE,
        display_name_en VARCHAR(100) NOT NULL,
        display_name_ar VARCHAR(100) NOT NULL,
        permissions JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        INDEX idx_role_name (role_name)
      ) ENGINE=InnoDB
    `);

    // Seeds for roles
    await pool.execute(`
      INSERT IGNORE INTO roles (role_id, role_name, display_name_en, display_name_ar) VALUES 
      (1, 'super_admin', 'Super Admin', 'مدير عام'),
      (2, 'manager', 'Manager', 'مدير'),
      (3, 'inventory_controller', 'Inventory Controller', 'مراقب المخزون'),
      (4, 'sales_dispatch', 'Sales & Dispatch', 'المبيعات والتوزيع')
    `);

    // 2. ADMINS TABLE
    console.log('Checking admins table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        admin_id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role_id INT,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        FOREIGN KEY (role_id) REFERENCES roles(role_id),
        INDEX idx_admin_username (username),
        INDEX idx_admin_email (email)
      ) ENGINE=InnoDB
    `);

    // Create default admin if not exists (username: admin, password: admin123)
    const [existingAdmins]: any = await pool.execute('SELECT admin_id FROM admins WHERE username = "admin"');
    if (existingAdmins.length === 0) {
      console.log('Creating default admin account...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await pool.execute(`
        INSERT INTO admins (username, email, password, role_id, first_name, status) 
        VALUES ('admin', 'admin@freshnfast.com', ?, 1, 'Main Admin', 'active')
      `, [hashedPassword]);
    }

    // 3. CATEGORIES TABLE (with parent support)
    console.log('Checking categories table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        category_id INT AUTO_INCREMENT PRIMARY KEY,
        parent_id INT DEFAULT NULL,
        name_en VARCHAR(100) NOT NULL,
        name_ar VARCHAR(100) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        FOREIGN KEY (parent_id) REFERENCES categories(category_id)
      ) ENGINE=InnoDB
    `);

    // 4. VENDORS & BRANCHES
    console.log('Checking vendors and branches...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS vendors (
        vendor_id INT AUTO_INCREMENT PRIMARY KEY,
        name_en VARCHAR(255) NOT NULL,
        name_ar VARCHAR(255),
        contact_person VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(100),
        address TEXT,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL
      ) ENGINE=InnoDB
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS branches (
        branch_id INT AUTO_INCREMENT PRIMARY KEY,
        name_en VARCHAR(255) NOT NULL,
        name_ar VARCHAR(255) NOT NULL,
        location_en TEXT,
        location_ar TEXT,
        phone VARCHAR(20),
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL
      ) ENGINE=InnoDB
    `);

    await pool.execute(`
      INSERT IGNORE INTO branches (branch_id, name_en, name_ar, phone) 
      VALUES (1, 'Main Warehouse', 'المستودع الرئيسي', '+965-00000000')
    `);

    // 5. INVENTORY & MENU
    console.log('Checking inventory items table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        inventory_item_id INT AUTO_INCREMENT PRIMARY KEY,
        name_en VARCHAR(255) NOT NULL,
        name_ar VARCHAR(255) NOT NULL,
        sku VARCHAR(50) UNIQUE,
        category_id INT,
        current_stock DECIMAL(10,3) DEFAULT 0.000,
        min_stock_level DECIMAL(10,3) DEFAULT 5.000,
        unit_en VARCHAR(20) DEFAULT 'kg',
        unit_ar VARCHAR(20) DEFAULT 'كجم',
        cost_price DECIMAL(10,3) DEFAULT 0.000,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        FOREIGN KEY (category_id) REFERENCES categories(category_id)
      ) ENGINE=InnoDB
    `);

    console.log('Checking menu items table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS menu_items (
        menu_item_id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT,
        name_en VARCHAR(255) NOT NULL,
        name_ar VARCHAR(255) NOT NULL,
        description_en TEXT,
        description_ar TEXT,
        price DECIMAL(10,3) NOT NULL DEFAULT 0.000,
        image_url VARCHAR(255),
        status ENUM('available', 'unavailable') DEFAULT 'available',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        FOREIGN KEY (category_id) REFERENCES categories(category_id)
      ) ENGINE=InnoDB
    `);

    // Seeds for sample data
    console.log('Seeding sample categories and menu items...');
    await pool.execute(`INSERT IGNORE INTO categories (category_id, name_en, name_ar) VALUES (1, 'Beverages', 'مشروبات'), (2, 'Food', 'طعام')`);
    
    await pool.execute(`
      INSERT IGNORE INTO menu_items (menu_item_id, category_id, name_en, name_ar, price, status) VALUES 
      (1, 1, 'Spanish Latte', 'سبانش لاتيه', 1.500, 'available'),
      (2, 1, 'Double Espresso', 'اسبريسو مزدوج', 1.000, 'available'),
      (3, 2, 'Grilled Chicken Burger', 'برجر دجاج مشوي', 2.250, 'available'),
      (4, 2, 'Club Sandwich', 'كلوب ساندوتش', 1.850, 'available')
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS menu_item_ingredients (
        ingredient_id INT AUTO_INCREMENT PRIMARY KEY,
        menu_item_id INT,
        inventory_item_id INT,
        quantity DECIMAL(10,3) NOT NULL,
        unit_en VARCHAR(20),
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id),
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id)
      ) ENGINE=InnoDB
    `);

    // 6. SALES ORDERS & WASTAGE
    console.log('Checking sales and wastage tables...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sales_orders (
        sale_id INT AUTO_INCREMENT PRIMARY KEY,
        order_number VARCHAR(50) NOT NULL UNIQUE,
        customer_name VARCHAR(255),
        total_amount DECIMAL(10,3) NOT NULL DEFAULT 0.000,
        payment_status ENUM('paid', 'pending', 'failed') DEFAULT 'paid',
        dispatch_status ENUM('pending', 'dispatched', 'delivered', 'cancelled') DEFAULT 'pending',
        admin_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES admins(admin_id)
      ) ENGINE=InnoDB
    `);

    // Ensure column name is 'sale_id' and all fields exist
    const [salesCols]: any = await pool.execute('DESCRIBE sales_orders');
    const existingSalesCols = salesCols.map((c: any) => c.Field);

    if (!existingSalesCols.includes('sale_id')) {
       console.log('Updating sales_orders column naming...');
       try {
         await pool.execute('ALTER TABLE sales_orders CHANGE sales_order_id sale_id INT AUTO_INCREMENT');
       } catch (e) {
         console.error('Rename failed (might already be correct):', e);
       }
    }
    
    if (!existingSalesCols.includes('payment_status')) {
      console.log('Adding payment_status column to sales_orders...');
      await pool.execute("ALTER TABLE sales_orders ADD COLUMN payment_status ENUM('paid', 'pending', 'failed') DEFAULT 'paid' AFTER total_amount");
    }
    
    if (!existingSalesCols.includes('dispatch_status')) {
      console.log('Adding dispatch_status column to sales_orders...');
      await pool.execute("ALTER TABLE sales_orders ADD COLUMN dispatch_status ENUM('pending', 'dispatched', 'delivered', 'cancelled') DEFAULT 'pending' AFTER payment_status");
    }
    
    if (!existingSalesCols.includes('total_amount')) {
      console.log('Adding missing financial columns to sales_orders...');
      await pool.execute('ALTER TABLE sales_orders ADD COLUMN total_amount DECIMAL(10,3) DEFAULT 0.000 AFTER customer_name');
    }

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS sales_order_items (
        item_id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT,
        menu_item_id INT,
        quantity DECIMAL(10,3) NOT NULL,
        price DECIMAL(10,3) NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales_orders(sale_id),
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id)
      ) ENGINE=InnoDB
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS wastage (
        wastage_id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NULL,
        inventory_item_id INT NULL,
        quantity DECIMAL(10,3) NOT NULL DEFAULT 0.000,
        reason_en VARCHAR(255),
        admin_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES admins(admin_id)
      ) ENGINE=InnoDB
    `);

    // 7. SYSTEM SETTINGS
    console.log('Checking system settings...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(50) NOT NULL UNIQUE,
        setting_value TEXT,
        description VARCHAR(255)
      ) ENGINE=InnoDB
    `);

    await pool.execute(`
      INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES 
      ('app_version', '1.0.0', 'Current version'),
      ('force_update', 'false', 'Update required flag'),
      ('currency_code', 'KWD', 'Local currency')
    `);

    console.log('Checking Audit Logs...');
    await pool.execute(`
       CREATE TABLE IF NOT EXISTS audit_logs (
        audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT,
        action VARCHAR(100) NOT NULL,
        entity_name VARCHAR(50),
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (admin_id) REFERENCES admins(admin_id)
      ) ENGINE=InnoDB
    `);

    console.log('✅ DATABASE FULLY SYNCHRONIZED AND REPAIRED.');
  } catch (error) {
    console.error('❌ Synchronizer failed:', error);
  } finally {
    process.exit();
  }
}

repairDB();
