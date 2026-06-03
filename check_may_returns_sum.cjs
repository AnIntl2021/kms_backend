const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkMayReturnsSum() {
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
        mi.name_en as product,
        SUM(ri.quantity) as returned_qty,
        SUM(ri.quantity * ri.unit_price * 0.65) as credit_value
      FROM sales_returns r
      JOIN sales_return_items ri ON r.return_id = ri.return_id
      JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
      WHERE r.vendor_id = ? 
      AND DATE(r.created_at) >= '2026-05-01' 
      AND DATE(r.created_at) <= '2026-05-31'
      GROUP BY mi.menu_item_id
    `, [vendorId]);

    console.log("May Returns by Product in System:");
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkMayReturnsSum();
