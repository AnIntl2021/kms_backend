const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkMayReturns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [vendors] = await connection.execute('SELECT vendor_id FROM vendors WHERE name_en LIKE "%Canteen%"');
    const vendorId = vendors[0].vendor_id;

    const [rows] = await connection.execute(`
      SELECT 
        r.return_id,
        r.created_at,
        r.total_credit_amount,
        SUM(ri.quantity) as total_items
      FROM sales_returns r
      JOIN sales_return_items ri ON r.return_id = ri.return_id
      WHERE r.vendor_id = ? 
      AND DATE(r.created_at) >= '2026-05-01' 
      AND DATE(r.created_at) <= '2026-05-31'
      GROUP BY r.return_id
    `, [vendorId]);

    console.log("May Returns in System:");
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkMayReturns();
