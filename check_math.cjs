const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkMath() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [vendors] = await connection.execute('SELECT vendor_id FROM vendors WHERE name_en LIKE "%Canteen%"');
    const vendorId = vendors[0].vendor_id;

    // Check Total Final Amount
    const [sales] = await connection.execute(`
      SELECT SUM(final_amount) as total_final 
      FROM sales_orders 
      WHERE vendor_id = ? AND DATE(created_at) >= '2026-05-01' AND DATE(created_at) <= '2026-05-31'
    `, [vendorId]);

    // Check Total Credit
    const [returns] = await connection.execute(`
      SELECT SUM(total_credit_amount) as total_credit 
      FROM sales_returns r
      JOIN sales_orders s ON r.sale_id = s.sale_id
      WHERE r.vendor_id = ? AND DATE(r.created_at) >= '2026-05-01' AND DATE(r.created_at) <= '2026-05-31'
    `, [vendorId]);

    const finalAmt = Number(sales[0].total_final || 0);
    const creditAmt = Number(returns[0].total_credit || 0);

    console.log("Total Final Amount in DB:", finalAmt.toFixed(3));
    console.log("Total Credit Amount in DB:", creditAmt.toFixed(3));
    console.log("Net Revenue (Final - Credit):", (finalAmt - creditAmt).toFixed(3));

    // Let's also recalculate it correctly in Node without Number.EPSILON just to see what Excel actually does
    const targetNet = 977.63;
    console.log("Target Net Revenue:", targetNet);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkMath();
