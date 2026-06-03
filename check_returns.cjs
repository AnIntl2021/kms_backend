const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  const [vendors] = await connection.execute('SELECT * FROM vendors WHERE name_en LIKE "%Canteen%" OR name_ar LIKE "%Canteen%"');
  const vendorId = vendors[0].vendor_id;
  
  const [returns] = await connection.execute(`
    SELECT sr.*, so.order_number, ri.quantity, ri.unit_price, mi.name_en as product_name
    FROM sales_returns sr
    JOIN sales_return_items ri ON sr.return_id = ri.return_id
    JOIN sales_orders so ON sr.sale_id = so.sale_id
    LEFT JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
    WHERE so.vendor_id = ? AND DATE(sr.created_at) >= "2026-04-01" AND DATE(sr.created_at) <= "2026-04-30"
  `, [vendorId]);

  console.log("Returns via sales_returns:", returns.length);
  if (returns.length > 0) {
    console.table(returns);
  }

  await connection.end();
}

check().catch(console.error);
