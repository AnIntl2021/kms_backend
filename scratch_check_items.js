import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  const [items] = await connection.execute("SELECT quantity, unit_price FROM sales_return_items WHERE return_id = 105");
  console.log('Items:', items);
  process.exit();
}
check();
