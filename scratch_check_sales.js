import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  const [orders] = await connection.execute("SELECT sale_id, discount_percentage FROM sales_orders WHERE sale_id IN (73, 84)");
  console.log('Orders:', orders);
  
  process.exit();
}
check();
