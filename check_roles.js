import mysql from 'mysql2/promise';

async function checkDbs() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master'
  });

  const [tenants] = await connection.execute('SELECT db_name FROM tenants;');
  console.log('Tenants:', tenants);

  for (const t of tenants) {
    try {
      const c2 = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: t.db_name
      });
      const [admins] = await c2.execute(`
        SELECT a.admin_id, a.username, r.role_name, r.display_name_en 
        FROM admins a LEFT JOIN roles r ON a.role_id = r.role_id
      `);
      console.log(`Admins in ${t.db_name}:`, admins);
      await c2.end();
    } catch(e) {
      console.log(`Failed for ${t.db_name}:`, e.message);
    }
  }

  await connection.end();
}

checkDbs().catch(console.error);
