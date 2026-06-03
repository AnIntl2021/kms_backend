import mysql from 'mysql2/promise';

async function fix() {
  const connection = await mysql.createConnection({
    host: '64.227.182.87',
    user: 'fnf_user',
    password: 'FreshFast_Admin_2026!',
    database: 'fresh_n_fast_prod'
  });

  const [returns] = await connection.execute(`
    SELECT r.return_id, r.sale_id, r.total_credit_amount,
           (SELECT discount_percentage FROM sales_orders WHERE sale_id = r.sale_id) as discount_percentage,
           (SELECT SUM(ri.quantity * ri.unit_price) FROM sales_return_items ri WHERE ri.return_id = r.return_id) as gross_amount
    FROM sales_returns r
    WHERE r.deleted_at IS NULL
  `);

  for (const r of returns) {
    if (r.gross_amount && r.discount_percentage) {
      const discountFactor = (100 - Number(r.discount_percentage)) / 100;
      const correctCredit = (Number(r.gross_amount) * discountFactor).toFixed(3);
      
      if (Math.abs(Number(r.total_credit_amount) - Number(correctCredit)) > 0.001) {
        console.log(`Fixing Return ${r.return_id}: ${r.total_credit_amount} -> ${correctCredit}`);
        await connection.execute("UPDATE sales_returns SET total_credit_amount = ? WHERE return_id = ?", [correctCredit, r.return_id]);
      }
    }
  }
  
  console.log("Database fixed!");
  process.exit();
}
fix();
