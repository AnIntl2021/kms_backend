const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  try {
    await connection.query('ALTER TABLE employees ADD COLUMN allowances JSON');
    console.log('JSON column added successfully');
  } catch (e) {
    console.log('Error:', e.message);
  }
  await connection.end();
}
run();
