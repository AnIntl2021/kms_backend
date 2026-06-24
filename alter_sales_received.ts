import mysql from 'mysql2/promise';

async function migrate() {
  const masterConnection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master'
  });

  const [tenants]: any = await masterConnection.execute('SELECT db_name FROM tenants;');
  const dbs = ['kms_master', ...tenants.map((t: any) => t.db_name)];

  for (const dbName of dbs) {
    console.log(`Migrating database ${dbName}...`);
    try {
      const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: dbName
      });

      // Alter payment_method ENUM to VARCHAR(50)
      try {
        await conn.execute(`ALTER TABLE sales_orders MODIFY COLUMN payment_method VARCHAR(50) DEFAULT 'cash'`);
        console.log(`  Altered payment_method in ${dbName}`);
      } catch (e: any) {
        console.error(`  Failed to alter payment_method in ${dbName}:`, e.message);
      }

      // Add received_amount
      try {
        await conn.execute(`ALTER TABLE sales_orders ADD COLUMN received_amount DECIMAL(10,3) NULL DEFAULT NULL`);
        console.log(`  Added received_amount to ${dbName}`);
      } catch (e: any) {
        console.log(`  received_amount might already exist or failed in ${dbName}:`, e.message);
      }

      // Add returned_amount
      try {
        await conn.execute(`ALTER TABLE sales_orders ADD COLUMN returned_amount DECIMAL(10,3) NULL DEFAULT NULL`);
        console.log(`  Added returned_amount to ${dbName}`);
      } catch (e: any) {
        console.log(`  returned_amount might already exist or failed in ${dbName}:`, e.message);
      }

      await conn.end();
    } catch (e: any) {
      console.error(`Could not connect to ${dbName}:`, e.message);
    }
  }

  await masterConnection.end();
}

migrate().catch(console.error);
