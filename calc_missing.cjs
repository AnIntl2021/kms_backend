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
  
  const [items] = await connection.execute(`
    SELECT mi.name_en, SUM(soi.quantity) as dispatched_qty, soi.price as unit_price
    FROM sales_order_items soi
    JOIN sales_orders so ON soi.sale_id = so.sale_id
    JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
    WHERE so.vendor_id = ? AND so.deleted_at IS NULL AND DATE(so.created_at) >= "2026-04-01" AND DATE(so.created_at) <= "2026-04-30"
    GROUP BY mi.name_en, soi.price
  `, [vendorId]);

  console.table(items);

  await connection.end();
}

check().catch(console.error);
