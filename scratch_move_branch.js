import mysql from 'mysql2/promise';

async function fix() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  const saleIds = [11, 49, 58];
  const branchId = 22; // On The Go Sharq

  console.log(`Moving sale IDs ${saleIds.join(', ')} to branch_id ${branchId}...`);
  
  await connection.execute(`UPDATE sales_orders SET branch_id = ? WHERE sale_id IN (${saleIds.join(',')})`, [branchId]);
  console.log("Updated sales_orders.");

  await connection.execute(`UPDATE sales_returns SET branch_id = ? WHERE sale_id IN (${saleIds.join(',')})`, [branchId]);
  console.log("Updated sales_returns.");

  process.exit();
}
fix();
