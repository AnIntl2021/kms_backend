const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master'
  });

  try {
    const [masterTables] = await connection.execute('SHOW TABLES;');
    console.log('kms_master TABLES:', masterTables.map(t => Object.values(t)[0]));

    const [tenantTables] = await connection.execute('SHOW DATABASES LIKE "kms_apple_1235";');
    if (tenantTables.length > 0) {
      const tenantConn = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'kms_apple_1235'
      });
      const [tables] = await tenantConn.execute('SHOW TABLES;');
      console.log('kms_apple_1235 TABLES:', tables.map(t => Object.values(t)[0]));
      await tenantConn.end();
    }
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

main();
