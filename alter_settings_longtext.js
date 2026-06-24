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
    console.log(`Checking system_settings in database ${dbName}...`);
    try {
      const conn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: dbName
      });

      // Change setting_value to LONGTEXT
      try {
        await conn.execute(`ALTER TABLE system_settings MODIFY COLUMN setting_value LONGTEXT NULL`);
        console.log(`  Altered setting_value to LONGTEXT in ${dbName}`);
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
