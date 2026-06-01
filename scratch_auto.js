import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  const [rows] = await connection.execute("SELECT sale_id, payment_status, expiry_date FROM sales_orders WHERE payment_status = 'credit' OR expiry_date <= CURRENT_DATE();");
  console.log('Orders matching the condition:');
  console.log(rows.slice(0, 5));
  process.exit();
}
check();
