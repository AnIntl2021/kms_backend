const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkJuneReturns() {
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
        r.created_at as return_date,
        s.created_at as sale_date,
        r.total_credit_amount
      FROM sales_returns r
      JOIN sales_orders s ON r.sale_id = s.sale_id
      WHERE r.vendor_id = ? 
      AND DATE(r.created_at) > '2026-05-31' 
      AND DATE(s.created_at) >= '2026-05-01'
      AND DATE(s.created_at) <= '2026-05-31'
    `, [vendorId]);

    console.log("Returns recorded in June for Sales made in May:");
    console.table(rows);
    
    let sum = 0;
    for (const r of rows) sum += Number(r.total_credit_amount);
    console.log("Total credit from June returns polluting May Sales:", sum.toFixed(3));

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkJuneReturns();
