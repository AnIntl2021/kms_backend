const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await c.execute(`
      SELECT s.sale_id, s.created_at, pb.name_en as branch, s.total_amount,
             IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0) as returns_amount
      FROM sales_orders s
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      WHERE s.deleted_at IS NULL 
        AND (v.name_en LIKE '%Canteen%' OR s.customer_name LIKE '%Canteen%')
        AND s.created_at >= '2026-05-31 00:00:00' 
        AND s.created_at <= '2026-05-31 23:59:59'
    `);
    
    console.log("MAY 31ST SALES:");
    let tSent = 0, tRet = 0;
    rows.forEach(r => {
      console.log(`Sale ID: ${r.sale_id} | Branch: ${r.branch} | Sent: ${r.total_amount} KD | Returned: ${r.returns_amount} KD`);
      tSent += Number(r.total_amount);
      tRet += Number(r.returns_amount);
    });
    console.log(`TOTALS | Sent: ${tSent.toFixed(3)} KD | Returned: ${tRet.toFixed(3)} KD`);

  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
