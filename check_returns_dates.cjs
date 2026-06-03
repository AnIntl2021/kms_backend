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
    SELECT sr.created_at as ReturnDate, so.created_at as SaleDate, so.order_number, sr.total_credit_amount
    FROM sales_returns sr
    JOIN sales_orders so ON sr.sale_id = so.sale_id
    WHERE so.vendor_id = ? AND DATE(so.created_at) >= "2026-04-01" AND DATE(so.created_at) <= "2026-04-30"
  `, [vendorId]);

  console.table(returns);

  await connection.end();
}

check().catch(console.error);
