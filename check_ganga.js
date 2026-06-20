import mysql from 'mysql2/promise';

async function checkGanga() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'kms_tenant_1'
  });

  const [rows] = await connection.execute(`
    SELECT a.*, r.role_name, r.display_name_en, r.display_name_ar, r.permissions 
    FROM admins a 
    LEFT JOIN roles r ON a.role_id = r.role_id 
    WHERE a.username = 'ganga'
  `);
  console.log('Ganga user details in tenant DB:', JSON.stringify(rows, null, 2));
  await connection.end();
}

checkGanga().catch(console.error);
