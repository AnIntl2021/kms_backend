import mysql from 'mysql2/promise';

async function checkAdmins() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master' // check master
  });

  const [rows] = await connection.execute('SELECT admin_id, username, role_id, role FROM admins;');
  console.log('Master Admins:', rows);
  await connection.end();

  // also check a tenant db, assuming its name is kms_tenant_1 or similar
  // let's just query kms_master.tenants to find the db name
  const c2 = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_master'
  });
  const [tenants] = await c2.execute('SELECT name, db_name FROM tenants;');
  console.log('Tenants:', tenants);
  await c2.end();
}

checkAdmins().catch(console.error);
