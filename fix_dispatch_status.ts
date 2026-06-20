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

      const addColumnIfNotExist = async (table: string, column: string, definition: string) => {
        const [columns]: any = await conn.execute(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
        if (columns.length === 0) {
            console.log(`+ Adding column [${column}] to table [${table}]...`);
            await conn.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        } else {
            console.log(`- Column [${column}] already exists in [${table}]`);
        }
      };

      await addColumnIfNotExist('sales_orders', 'batch_number', 'VARCHAR(100) AFTER admin_id');
      await addColumnIfNotExist('sales_orders', 'expiry_date', 'DATE AFTER batch_number');
      await addColumnIfNotExist('sales_orders', 'dispatch_status', "ENUM('pending', 'dispatched', 'in_transit', 'delivered', 'returned', 'cancelled') DEFAULT 'pending' AFTER expiry_date");

      // Auto-set dispatch_status for POS walk-in orders
      await conn.execute(`UPDATE sales_orders SET dispatch_status = 'delivered' WHERE order_type = 'walk_in' OR payment_status = 'paid'`);

      await conn.end();
    } catch (e: any) {
      console.log(`Could not connect to ${dbName}:`, e.message);
    }
  }

  await masterConnection.end();
}

fixDatabases().catch(console.error);
