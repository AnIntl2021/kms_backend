const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkMay() {
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
        SUM(soi.quantity) as dispatched_qty,
        SUM(soi.quantity * mi.price) as gross_value
      FROM sales_orders s
      JOIN sales_order_items soi ON s.sale_id = soi.sale_id
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      WHERE s.vendor_id = ? 
      AND DATE(s.created_at) >= '2026-05-01' 
      AND DATE(s.created_at) <= '2026-05-31'
      AND s.deleted_at IS NULL
      GROUP BY mi.menu_item_id
    `, [vendorId]);

    console.log("May Dispatches to Canteen:");
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkMay();
