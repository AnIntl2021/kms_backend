const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  try {
    await connection.query('ALTER TABLE employees ADD COLUMN basic_salary DECIMAL(10,3) DEFAULT 0.000, ADD COLUMN housing_allowance DECIMAL(10,3) DEFAULT 0.000, ADD COLUMN transportation_allowance DECIMAL(10,3) DEFAULT 0.000, ADD COLUMN other_allowances DECIMAL(10,3) DEFAULT 0.000');
    console.log('Columns added to remote DB');
  } catch (e) {
    console.log('Error:', e.message);
  }
  await connection.end();
}
run();
