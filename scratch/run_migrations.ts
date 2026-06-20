import mysql from 'mysql2/promise';
import { config } from '../src/config/config';

const dbConfig = {
  host: config.db.host,
  user: config.db.user,
  password: config.db.pass,
};

async function migrate() {
  console.log('🚀 Starting Multi-Brand & Stock Transfer Schema Migrations...');
  
  const connection = await mysql.createConnection({
    ...dbConfig,
    database: 'kms_master'
  });

  try {
    // 1. Fetch all tenant databases
    const [tenants]: any = await connection.execute('SELECT db_name, name FROM tenants WHERE status = "Active"');
    console.log(`Found ${tenants.length} active tenants to migrate.`);

    for (const tenant of tenants) {
      const dbName = tenant.db_name;
      console.log(`\n⏳ Migrating tenant: ${tenant.name} (${dbName})...`);
      
      const tenantConnection = await mysql.createConnection({
        ...dbConfig,
        database: dbName
      });

      try {
        // Create brands table
        await tenantConnection.query(`
          CREATE TABLE IF NOT EXISTS brands (
            brand_id INT AUTO_INCREMENT PRIMARY KEY,
            name_en VARCHAR(255) NOT NULL,
            name_ar VARCHAR(255) NOT NULL,
            status ENUM('active', 'inactive') DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP NULL
          ) ENGINE=InnoDB
        `);
        console.log('  ✅ Table "brands" created or verified.');

        // Alter branches
        try {
          await tenantConnection.query('ALTER TABLE branches ADD COLUMN brand_id INT NULL');
          await tenantConnection.query('ALTER TABLE branches ADD FOREIGN KEY (brand_id) REFERENCES brands(brand_id)');
          console.log('  ✅ Altered "branches" to add brand_id column.');
        } catch (e: any) {
          console.log('  ℹ️ "branches" alter skipped (likely already altered).');
        }

        // Alter admins
        try {
          await tenantConnection.query('ALTER TABLE admins ADD COLUMN brand_id INT NULL');
          await tenantConnection.query('ALTER TABLE admins ADD FOREIGN KEY (brand_id) REFERENCES brands(brand_id)');
          console.log('  ✅ Altered "admins" to add brand_id column.');
        } catch (e: any) {
          console.log('  ℹ️ "admins" alter skipped.');
        }

        // Alter menu_items
        try {
          await tenantConnection.query('ALTER TABLE menu_items ADD COLUMN brand_id INT NULL');
          await tenantConnection.query('ALTER TABLE menu_items ADD FOREIGN KEY (brand_id) REFERENCES brands(brand_id)');
          console.log('  ✅ Altered "menu_items" to add brand_id column.');
        } catch (e: any) {
          console.log('  ℹ️ "menu_items" alter skipped.');
        }

        // Alter inventory_items
        try {
          await tenantConnection.query('ALTER TABLE inventory_items ADD COLUMN brand_id INT NULL');
          await tenantConnection.query('ALTER TABLE inventory_items ADD FOREIGN KEY (brand_id) REFERENCES brands(brand_id)');
          console.log('  ✅ Altered "inventory_items" to add brand_id column.');
        } catch (e: any) {
          console.log('  ℹ️ "inventory_items" alter skipped.');
        }

        // Alter sales_orders
        try {
          await tenantConnection.query('ALTER TABLE sales_orders ADD COLUMN brand_id INT NULL');
          await tenantConnection.query('ALTER TABLE sales_orders ADD FOREIGN KEY (brand_id) REFERENCES brands(brand_id)');
          console.log('  ✅ Altered "sales_orders" to add brand_id column.');
        } catch (e: any) {
          console.log('  ℹ️ "sales_orders" alter skipped.');
        }

        // Create stock_transfers
        await tenantConnection.query(`
          CREATE TABLE IF NOT EXISTS stock_transfers (
            transfer_id INT AUTO_INCREMENT PRIMARY KEY,
            from_branch_id INT NULL,
            to_branch_id INT NOT NULL,
            status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
            notes TEXT,
            created_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (from_branch_id) REFERENCES branches(branch_id),
            FOREIGN KEY (to_branch_id) REFERENCES branches(branch_id),
            FOREIGN KEY (created_by) REFERENCES admins(admin_id)
          ) ENGINE=InnoDB
        `);
        console.log('  ✅ Table "stock_transfers" created or verified.');

        // Create stock_transfer_items
        await tenantConnection.query(`
          CREATE TABLE IF NOT EXISTS stock_transfer_items (
            transfer_item_id INT AUTO_INCREMENT PRIMARY KEY,
            transfer_id INT NOT NULL,
            inventory_item_id INT NOT NULL,
            quantity DECIMAL(10,3) NOT NULL,
            FOREIGN KEY (transfer_id) REFERENCES stock_transfers(transfer_id) ON DELETE CASCADE,
            FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id)
          ) ENGINE=InnoDB
        `);
        console.log('  ✅ Table "stock_transfer_items" created or verified.');

        console.log(`  🎉 Finished migration for ${tenant.name}.`);
      } catch (err: any) {
        console.error(`  ❌ Failed migrating ${tenant.name}:`, err.message);
      } finally {
        await tenantConnection.end();
      }
    }
  } catch (error: any) {
    console.error('❌ Migration script failed:', error.message);
  } finally {
    await connection.end();
    console.log('\n🏁 Migrations run finished!');
    process.exit(0);
  }
}

migrate();
