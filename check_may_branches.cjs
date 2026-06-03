const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkMayBranches() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [vendors] = await connection.execute('SELECT vendor_id FROM vendors WHERE name_en LIKE "%Canteen%"');
    const vendorId = vendors[0].vendor_id;

    // Dispatches per branch
    const [dispatches] = await connection.execute(`
      SELECT 
        pb.name_en as branch,
        SUM(s.final_amount) as dispatched_value,
        SUM(soi.quantity) as dispatched_qty
      FROM sales_orders s
      JOIN sales_order_items soi ON s.sale_id = soi.sale_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      WHERE s.vendor_id = ? 
      AND DATE(s.created_at) >= '2026-05-01' 
      AND DATE(s.created_at) <= '2026-05-31'
      AND s.deleted_at IS NULL
      GROUP BY pb.branch_id
    `, [vendorId]);

    console.log("May Dispatches by Branch:");
    console.table(dispatches);

    // Returns per branch
    const [returns] = await connection.execute(`
      SELECT 
        pb.name_en as branch,
        SUM(r.total_credit_amount) as returned_value,
        SUM(ri.quantity) as returned_qty
      FROM sales_returns r
      JOIN sales_return_items ri ON r.return_id = ri.return_id
      LEFT JOIN partner_branches pb ON r.branch_id = pb.branch_id
      WHERE r.vendor_id = ? 
      AND DATE(r.created_at) >= '2026-05-01' 
      AND DATE(r.created_at) <= '2026-05-31'
      GROUP BY pb.branch_id
    `, [vendorId]);

    console.log("May Returns by Branch:");
    console.table(returns);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkMayBranches();
