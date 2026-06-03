import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  const [orders] = await connection.execute("SELECT sale_id, order_number, total_amount, discount_amount, discount_percentage, final_amount FROM sales_orders WHERE sale_id IN (141, 179)");
  console.log('Orders:', orders);
  
  const [returns] = await connection.execute("SELECT * FROM sales_returns WHERE sale_id IN (141, 179)");
  console.log('Returns:', returns);
  process.exit();
}
check();
