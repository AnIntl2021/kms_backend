const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkRevenue() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await connection.execute(`
      SELECT 
        SUM(total_amount) as total_gross,
        SUM(final_amount) as total_final
      FROM sales_orders 
      WHERE DATE(created_at) >= '2026-05-01' 
      AND DATE(created_at) <= '2026-05-31'
      AND deleted_at IS NULL
    `);

    const [canteenRows] = await connection.execute(`
      SELECT 
        SUM(total_amount) as total_gross,
        SUM(final_amount) as total_final
      FROM sales_orders s
      JOIN vendors v ON s.vendor_id = v.vendor_id
      WHERE v.name_en LIKE "%Canteen%"
      AND DATE(s.created_at) >= '2026-05-01' 
      AND DATE(s.created_at) <= '2026-05-31'
      AND s.deleted_at IS NULL
    `);

    console.log("All Vendors May Revenue:", rows[0]);
    console.log("Canteen Only May Revenue:", canteenRows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkRevenue();
