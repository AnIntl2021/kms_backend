const mysql = require('mysql2/promise');

async function run() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  try {
    await connection.query('ALTER TABLE sales_orders ADD COLUMN client_phone VARCHAR(50) DEFAULT NULL AFTER customer_name');
    await connection.query('ALTER TABLE sales_orders ADD COLUMN client_address TEXT DEFAULT NULL AFTER client_phone');
    await connection.query('ALTER TABLE sales_orders ADD COLUMN reference_order_number VARCHAR(100) DEFAULT NULL AFTER order_number');
    await connection.query('ALTER TABLE sales_orders ADD COLUMN notes TEXT DEFAULT NULL AFTER client_address');
    console.log('Columns added successfully');
  } catch (e) {
    console.log('Error adding columns:', e.message);
  }
  await connection.end();
}
run();
