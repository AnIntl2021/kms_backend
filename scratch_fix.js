import mysql from 'mysql2/promise';

async function fix() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  await connection.execute("ALTER TABLE sales_orders MODIFY COLUMN payment_status ENUM('paid', 'pending', 'failed', 'credit') DEFAULT 'paid'");
  console.log('Fixed payment_status enum');
  process.exit();
}
fix();
