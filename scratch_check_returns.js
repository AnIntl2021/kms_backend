import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  const [returns] = await connection.execute("SELECT return_id, sale_id FROM sales_returns WHERE return_id IN (39, 43)");
  console.log('Returns:', returns);
  
  process.exit();
}
check();
