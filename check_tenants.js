import mysql from 'mysql2/promise';

async function checkTenants() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master'
  });

  const [rows] = await connection.execute('SELECT tenant_id, name, db_name, contact_email, status FROM tenants');
  console.log(JSON.stringify(rows, null, 2));
  await connection.end();
}

checkTenants().catch(console.error);
