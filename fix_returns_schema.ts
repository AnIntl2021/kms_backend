import mysql from 'mysql2/promise';

async function fixDatabases() {
  const masterConnection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master'
  });

  const [tenants]: any = await masterConnection.execute('SELECT db_name FROM tenants;');
  const dbs = ['kms_master', ...tenants.map((t: any) => t.db_name)];

  for (const dbName of dbs) {
    console.log(`Fixing ${dbName}...`);
    try {
      const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: dbName
      });

      // 1. Create sales_returns
      try {
        await conn.execute(`
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
        console.log(`Created sales_returns in ${dbName}`);
      } catch (e: any) {
        console.log('Failed to create sales_returns:', e.message);
      }

      // 2. Create sales_return_items
      try {
        await conn.execute(`
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
        console.log(`Created sales_return_items in ${dbName}`);
      } catch (e: any) {
        // If it failed because it exists but has product_id instead of menu_item_id
        console.log('Failed to create sales_return_items:', e.message);
        
        try {
          const [cols]: any = await conn.execute(`SHOW COLUMNS FROM sales_return_items LIKE 'product_id'`);
          if (cols.length > 0) {
             console.log(`Renaming product_id to menu_item_id in sales_return_items in ${dbName}...`);
             await conn.execute(`ALTER TABLE sales_return_items CHANGE product_id menu_item_id INT`);
          }
        } catch (innerErr: any) {
          console.log('Failed to rename product_id:', innerErr.message);
        }
      }

      await conn.end();
    } catch (e: any) {
      console.log(`Could not connect to ${dbName}:`, e.message);
    }
  }

  await masterConnection.end();
}

fixDatabases().catch(console.error);
