const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  try {
    await connection.query('ALTER TABLE employees DROP COLUMN basic_salary, DROP COLUMN housing_allowance, DROP COLUMN transportation_allowance, DROP COLUMN other_allowances');
    console.log('Old columns dropped successfully');
  } catch (e) {
    console.log('Error dropping columns:', e.message);
  }
  await connection.end();
}
run();
