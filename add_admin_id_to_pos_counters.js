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
    console.log(`Checking pos_counters in database ${dbName}...`);
    try {
      const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: dbName
      });

      // Add admin_id column if it doesn't exist
      try {
        const [cols] = await conn.execute(`SHOW COLUMNS FROM pos_counters LIKE 'admin_id'`);
        if (cols.length === 0) {
          await conn.execute(`ALTER TABLE pos_counters ADD COLUMN admin_id INT NULL DEFAULT NULL AFTER branch_id`);
          await conn.execute(`ALTER TABLE pos_counters ADD CONSTRAINT fk_pos_counter_admin FOREIGN KEY (admin_id) REFERENCES admins(admin_id) ON DELETE SET NULL`);
          console.log(`  Added admin_id and foreign key constraint in ${dbName}`);
        } else {
          console.log(`  admin_id column already exists in ${dbName}`);
        }
      } catch (e) {
        console.error(`  Failed in ${dbName}:`, e.message);
      }

      await conn.end();
    } catch (e) {
      console.error(`Could not connect to ${dbName}:`, e.message);
    }
  }

  await masterConnection.end();
}

migrate().catch(console.error);
