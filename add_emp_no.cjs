const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  try {
    await connection.query('ALTER TABLE employees ADD COLUMN employee_no VARCHAR(50) DEFAULT NULL AFTER employee_id');
    console.log('employee_no column added successfully');
  } catch (e) {
    console.log('Error adding column:', e.message);
  }
  await connection.end();
}
run();
