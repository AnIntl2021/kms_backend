import pool from './src/config/db';

async function repairDB() {
  try {
    console.log('--- Database All-in-One Repair Script (Elite Procurement) ---');
    
    // 1. Categories (parent_id)
    const [catCols]: any = await pool.execute('DESCRIBE categories');
    if (!catCols.some((c: any) => c.Field === 'parent_id')) {
      console.log('Adding parent_id to categories...');
      await pool.execute('ALTER TABLE categories ADD COLUMN parent_id INT DEFAULT NULL AFTER category_id');
      await pool.execute('ALTER TABLE categories ADD FOREIGN KEY (parent_id) REFERENCES categories(category_id)');
    }

    // 2. Vendors Table
    console.log('Checking Vendors table...');
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

    // 2.5 Branches Table
    console.log('Checking Branches table...');
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

    // Ensure main branch exists
    await pool.execute(`
      INSERT IGNORE INTO branches (branch_id, name_en, name_ar, location_en, location_ar, phone) 
      VALUES (1, 'Main Branch', 'الفرع الرئيسي', 'Warehouse Area', 'منطقة المستودعات', '+965-00000000')
    `);

    // 2.6 Product Packages
    console.log('Checking Inventory Packages table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS inventory_item_packages (
        package_id INT AUTO_INCREMENT PRIMARY KEY,
        inventory_item_id INT,
        name_en VARCHAR(255) NOT NULL,
        name_ar VARCHAR(255),
        multiplier DECIMAL(10,3) DEFAULT 1.000,
        base_price DECIMAL(10,3) DEFAULT 0.000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id)
      ) ENGINE=InnoDB
    `);

    // 3. Purchase Orders
    console.log('Checking Purchase Orders...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        purchase_id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_id INT,
        admin_id INT,
        branch_id INT,
        po_number VARCHAR(50) NOT NULL UNIQUE,
        invoice_type ENUM('tax_invoice', 'simplified_invoice', 'proforma', 'debit_note') DEFAULT 'tax_invoice',
        total_amount DECIMAL(10,3) DEFAULT 0.000,
        tax_amount DECIMAL(10,3) DEFAULT 0.000,
        discount_amount DECIMAL(10,3) DEFAULT 0.000,
        discount_percentage DECIMAL(5,2) DEFAULT 0.00,
        additional_charges DECIMAL(10,3) DEFAULT 0.000,
        final_amount DECIMAL(10,3) DEFAULT 0.000,
        status ENUM('draft', 'pending', 'received', 'partially_received', 'cancelled') DEFAULT 'draft',
        notes TEXT,
        received_at TIMESTAMP NULL,
        received_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL,
        FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id),
        FOREIGN KEY (admin_id) REFERENCES admins(admin_id),
        FOREIGN KEY (received_by) REFERENCES admins(admin_id),
        FOREIGN KEY (branch_id) REFERENCES branches(branch_id)
      ) ENGINE=InnoDB
    `);

    // ALTER purchase_orders if columns missing
    const [poCols]: any = await pool.execute('DESCRIBE purchase_orders');
    const existingPoCols = poCols.map((c: any) => c.Field);
    
    if (!existingPoCols.includes('branch_id')) {
      console.log('Adding branch_id to purchase_orders...');
      await pool.execute('ALTER TABLE purchase_orders ADD COLUMN branch_id INT AFTER admin_id');
      await pool.execute('ALTER TABLE purchase_orders ADD FOREIGN KEY (branch_id) REFERENCES branches(branch_id)');
      await pool.execute('UPDATE purchase_orders SET branch_id = 1 WHERE branch_id IS NULL');
    }
    if (!existingPoCols.includes('invoice_type')) {
      console.log('Adding invoice_type to purchase_orders...');
      await pool.execute("ALTER TABLE purchase_orders ADD COLUMN invoice_type ENUM('tax_invoice', 'simplified_invoice', 'proforma', 'debit_note') DEFAULT 'tax_invoice' AFTER po_number");
    }
    if (!existingPoCols.includes('tax_amount')) {
      console.log('Adding financial columns to purchase_orders...');
      await pool.execute('ALTER TABLE purchase_orders ADD COLUMN tax_amount DECIMAL(10,3) DEFAULT 0.000 AFTER total_amount');
      await pool.execute('ALTER TABLE purchase_orders ADD COLUMN discount_amount DECIMAL(10,3) DEFAULT 0.000 AFTER tax_amount');
      await pool.execute('ALTER TABLE purchase_orders ADD COLUMN discount_percentage DECIMAL(5,2) DEFAULT 0.00 AFTER discount_amount');
      await pool.execute('ALTER TABLE purchase_orders ADD COLUMN additional_charges DECIMAL(10,3) DEFAULT 0.000 AFTER discount_percentage');
      await pool.execute('ALTER TABLE purchase_orders ADD COLUMN final_amount DECIMAL(10,3) DEFAULT 0.000 AFTER additional_charges');
    }
    if (existingPoCols.includes('status')) {
      // Update enum values for status if needed
      await pool.execute("ALTER TABLE purchase_orders MODIFY COLUMN status ENUM('draft', 'pending', 'received', 'partially_received', 'cancelled') DEFAULT 'draft'");
    }

    // 4. Purchase Order Items
    console.log('Checking Purchase Order Items...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        po_item_id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id INT,
        inventory_item_id INT,
        variant_id INT NULL,
        package_id INT NULL,
        quantity DECIMAL(10,3) NOT NULL,
        unit_price DECIMAL(10,3) NOT NULL,
        amount DECIMAL(10,3) DEFAULT 0.000,
        discount_amount DECIMAL(10,3) DEFAULT 0.000,
        additional_charges_percentage DECIMAL(5,2) DEFAULT 0.00,
        additional_charges_amount DECIMAL(10,3) DEFAULT 0.000,
        final_amount DECIMAL(10,3) DEFAULT 0.000,
        expiry_date DATE NULL,
        FOREIGN KEY (purchase_id) REFERENCES purchase_orders(purchase_id),
        FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id),
        FOREIGN KEY (package_id) REFERENCES inventory_item_packages(package_id)
      ) ENGINE=InnoDB
    `);

    const [poiCols]: any = await pool.execute('DESCRIBE purchase_order_items');
    const existingPoiCols = poiCols.map((c: any) => c.Field);

    if (!existingPoiCols.includes('variant_id')) {
      console.log('Adding variant_id to purchase_order_items...');
      await pool.execute('ALTER TABLE purchase_order_items ADD COLUMN variant_id INT NULL AFTER inventory_item_id');
    }
    if (!existingPoiCols.includes('package_id')) {
      console.log('Adding package_id to purchase_order_items...');
      await pool.execute('ALTER TABLE purchase_order_items ADD COLUMN package_id INT NULL AFTER variant_id');
      await pool.execute('ALTER TABLE purchase_order_items ADD FOREIGN KEY (package_id) REFERENCES inventory_item_packages(package_id)');
    }
    if (!existingPoiCols.includes('amount')) {
      console.log('Adding amount column to purchase_order_items...');
      await pool.execute('ALTER TABLE purchase_order_items ADD COLUMN amount DECIMAL(10,3) DEFAULT 0.000 AFTER unit_price');
    }
    if (!existingPoiCols.includes('discount_amount')) {
      console.log('Adding discount_amount column to purchase_order_items...');
      await pool.execute('ALTER TABLE purchase_order_items ADD COLUMN discount_amount DECIMAL(10,3) DEFAULT 0.000 AFTER amount');
    }
    if (!existingPoiCols.includes('additional_charges_percentage')) {
      console.log('Adding line additional charges columns to purchase_order_items...');
      await pool.execute('ALTER TABLE purchase_order_items ADD COLUMN additional_charges_percentage DECIMAL(5,2) DEFAULT 0.00 AFTER discount_amount');
      await pool.execute('ALTER TABLE purchase_order_items ADD COLUMN additional_charges_amount DECIMAL(10,3) DEFAULT 0.000 AFTER additional_charges_percentage');
    }
    if (!existingPoiCols.includes('final_amount')) {
      console.log('Adding final_amount column to purchase_order_items...');
      await pool.execute('ALTER TABLE purchase_order_items ADD COLUMN final_amount DECIMAL(10,3) DEFAULT 0.000 AFTER additional_charges_amount');
    }
    if (!existingPoiCols.includes('expiry_date')) {
      console.log('Adding expiry_date to purchase_order_items...');
      await pool.execute('ALTER TABLE purchase_order_items ADD COLUMN expiry_date DATE NULL AFTER final_amount');
    }

    // 5. Menu Items
    console.log('Checking Menu Items...');
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

    // 6. Menu Ingredients
    console.log('Checking Menu Ingredients...');
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

    console.log('✅ ALL TABLES REPAIRED AND UPGRADED TO ELITE PROCUREMENT SUCCESSFUL!');
  } catch (error) {
    console.error('❌ Repair failed:', error);
  } finally {
    process.exit();
  }
}

repairDB();
