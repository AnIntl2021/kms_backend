import mysql from 'mysql2/promise';

async function migrateExistingTenants() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master'
  });

  const [tenants] = await connection.execute('SELECT db_name FROM tenants;');
  
  for (const tenant of tenants) {
    const dbName = tenant.db_name;
    console.log(`Migrating ${dbName}...`);
    
    try {
      const c2 = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: dbName
      });
      
      // 1. Ensure branches table exists
      await c2.execute(`
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
          deleted_at TIMESTAMP NULL,
          INDEX idx_branch_name (name_en)
        ) ENGINE=InnoDB;
      `);
      
      // Insert default branch
      await c2.execute(`
        INSERT IGNORE INTO branches (branch_id, name_en, name_ar, location_en, location_ar, phone) 
        VALUES (1, 'Main Branch', 'الفرع الرئيسي', 'Warehouse Area', 'منطقة المستودعات', '+965-00000000');
      `);

      // 2. Add branch_id to admins
      try {
        await c2.execute(`ALTER TABLE admins ADD COLUMN branch_id INT NULL AFTER role_id`);
        await c2.execute(`ALTER TABLE admins ADD CONSTRAINT fk_admin_branch FOREIGN KEY (branch_id) REFERENCES branches(branch_id)`);
      } catch(e) { console.log('admins alter failed (might exist):', e.message); }

      // 3. Add columns to sales_orders
      try {
        await c2.execute(`ALTER TABLE sales_orders ADD COLUMN branch_id INT NOT NULL DEFAULT 1 AFTER sales_order_id`);
        await c2.execute(`ALTER TABLE sales_orders ADD CONSTRAINT fk_sales_branch FOREIGN KEY (branch_id) REFERENCES branches(branch_id)`);
      } catch(e) { console.log('sales_orders branch_id failed:', e.message); }
      
      try {
        await c2.execute(`ALTER TABLE sales_orders ADD COLUMN order_type ENUM('walk_in', 'delivery', 'takeaway', 'b2b') DEFAULT 'walk_in' AFTER reference_order_number`);
        await c2.execute(`ALTER TABLE sales_orders ADD COLUMN payment_method ENUM('cash', 'card', 'online', 'credit') DEFAULT 'cash' AFTER order_type`);
      } catch(e) { console.log('sales_orders types failed:', e.message); }

      console.log(`Successfully migrated ${dbName}`);
      await c2.end();
    } catch(err) {
      console.log(`Failed to migrate ${dbName}:`, err.message);
    }
  }

  await connection.end();
}

migrateExistingTenants().catch(console.error);
