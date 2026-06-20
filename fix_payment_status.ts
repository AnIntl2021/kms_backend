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

      // Add payment_status column
      try {
        const [cols]: any = await conn.execute(`SHOW COLUMNS FROM sales_orders LIKE 'payment_status'`);
        if (cols.length === 0) {
           console.log(`Adding payment_status to sales_orders in ${dbName}...`);
           await conn.execute(`ALTER TABLE sales_orders ADD COLUMN payment_status ENUM('paid', 'credit', 'pending', 'failed') DEFAULT 'paid' AFTER payment_method`);
           // Set existing records based on payment_method
           await conn.execute(`UPDATE sales_orders SET payment_status = 'paid' WHERE payment_method IN ('cash', 'card', 'online')`);
           await conn.execute(`UPDATE sales_orders SET payment_status = 'credit' WHERE payment_method = 'credit'`);
        } else {
           console.log(`payment_status already exists in ${dbName}`);
           // Just fix existing null or empty statuses if any
           await conn.execute(`UPDATE sales_orders SET payment_status = 'paid' WHERE payment_status IS NULL AND payment_method IN ('cash', 'card', 'online')`);
           await conn.execute(`UPDATE sales_orders SET payment_status = 'credit' WHERE payment_status IS NULL AND payment_method = 'credit'`);
        }
      } catch (innerErr: any) {
        console.log('Failed to add payment_status:', innerErr.message);
      }

      await conn.end();
    } catch (e: any) {
      console.log(`Could not connect to ${dbName}:`, e.message);
    }
  }

  await masterConnection.end();
}

fixDatabases().catch(console.error);
