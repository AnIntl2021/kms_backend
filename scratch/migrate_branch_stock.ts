import mysql from 'mysql2/promise';
import { config } from '../src/config/config';

const dbConfig = {
  host: config.db.host,
  user: config.db.user,
  password: config.db.pass,
};

async function migrate() {
  console.log('🚀 Starting Branch-Stock Multi-Location Inventory Migration...');
  
  const connection = await mysql.createConnection({
    ...dbConfig,
    database: 'kms_master'
  });

  try {
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
        // 1. Create branch_stock table
        await tenantConnection.query(`
          CREATE TABLE IF NOT EXISTS branch_stock (
            branch_stock_id INT AUTO_INCREMENT PRIMARY KEY,
            branch_id INT NOT NULL,
            inventory_item_id INT NOT NULL,
            quantity DECIMAL(10,3) NOT NULL DEFAULT 0.000,
            FOREIGN KEY (branch_id) REFERENCES branches(branch_id),
            FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id),
            UNIQUE KEY idx_branch_item (branch_id, inventory_item_id)
          ) ENGINE=InnoDB
        `);
        console.log('  ✅ Table "branch_stock" created or verified.');

        // 2. Fetch the first branch (destination)
        const [branches]: any = await tenantConnection.execute('SELECT branch_id FROM branches LIMIT 1');
        if (branches.length === 0) {
          console.log('  ⚠️ No branches found to seed initial stock to. Skipping seeding.');
          continue;
        }
        
        const defaultBranchId = branches[0].branch_id;
        console.log(`  Seeding initial inventory to branch ID: ${defaultBranchId}`);

        // 3. Fetch current stock from inventory_items
        const [items]: any = await tenantConnection.execute('SELECT inventory_item_id, current_stock FROM inventory_items');
        console.log(`  Found ${items.length} inventory items to seed.`);

        let seededCount = 0;
        for (const item of items) {
          try {
            await tenantConnection.execute(
              'INSERT INTO branch_stock (branch_id, inventory_item_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = ?',
              [defaultBranchId, item.inventory_item_id, item.current_stock || 0, item.current_stock || 0]
            );
            seededCount++;
          } catch (err: any) {
            // ignore duplicate errors
          }
        }
        console.log(`  ✅ Successfully seeded/synced ${seededCount} items to branch stock.`);
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
    console.log('\n🏁 Branch Stock migration run finished!');
    process.exit(0);
  }
}

migrate();
