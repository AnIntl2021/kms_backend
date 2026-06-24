import mysql from 'mysql2/promise';

async function migrate() {
  const masterConnection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master'
  });

  const [tenants] = await masterConnection.execute('SELECT db_name FROM tenants;');
  const dbs = ['kms_master', ...tenants.map(t => t.db_name)];

  for (const dbName of dbs) {
    console.log(`Checking database ${dbName}...`);
    try {
      const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: dbName
      });

      // Add table_number to sales_orders if missing
      try {
        const [cols] = await conn.execute(`SHOW COLUMNS FROM sales_orders LIKE 'table_number'`);
        if (cols.length === 0) {
          await conn.execute(`ALTER TABLE sales_orders ADD COLUMN table_number VARCHAR(50) NULL DEFAULT NULL`);
          console.log(`  Added table_number column to ${dbName}`);
        } else {
          console.log(`  table_number already exists in ${dbName}`);
        }
      } catch (e) {
        console.log(`  Skipping or error in ${dbName}:`, e.message);
      }

      await conn.end();
    } catch (e) {
      console.error(`Could not connect to ${dbName}:`, e.message);
    }
  }

  await masterConnection.end();
}

migrate().catch(console.error);
