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

      // 1. Rename sales_order_id to sale_id
      try {
        const [cols]: any = await conn.execute(`SHOW COLUMNS FROM sales_orders LIKE 'sales_order_id'`);
        if (cols.length > 0) {
          console.log(`Renaming sales_order_id to sale_id in ${dbName}...`);
          await conn.execute(`ALTER TABLE sales_orders CHANGE sales_order_id sale_id INT AUTO_INCREMENT`);
        }
      } catch (e: any) {
        console.log('Failed to rename column:', e.message);
      }

      // 2. Create sales_order_items
      try {
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS sales_order_items (
            item_id INT AUTO_INCREMENT PRIMARY KEY,
            sale_id INT,
            menu_item_id INT,
            quantity DECIMAL(10,3) NOT NULL,
            price DECIMAL(10,3) NOT NULL,
            expiry_date DATE NULL,
            batch_number VARCHAR(50) NULL,
            FOREIGN KEY (sale_id) REFERENCES sales_orders(sale_id) ON DELETE CASCADE,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id)
          ) ENGINE=InnoDB;
        `);
        console.log(`Created sales_order_items in ${dbName}`);
      } catch (e: any) {
        console.log('Failed to create sales_order_items:', e.message);
      }

      await conn.end();
    } catch (e: any) {
      console.log(`Could not connect to ${dbName}:`, e.message);
    }
  }

  await masterConnection.end();
}

fixDatabases().catch(console.error);
