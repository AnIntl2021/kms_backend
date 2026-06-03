const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDiscount() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [vendors] = await connection.execute('SELECT vendor_id FROM vendors WHERE name_en LIKE "%Canteen%"');
    const vendorId = vendors[0].vendor_id;

    const [sales] = await connection.execute(`
      SELECT SUM(total_amount) as t, SUM(discount_amount) as d, SUM(final_amount) as f
      FROM sales_orders 
      WHERE vendor_id = ? AND DATE(created_at) >= '2026-05-01' AND DATE(created_at) <= '2026-05-31'
    `, [vendorId]);

    console.log("Total Amount:", sales[0].t);
    console.log("Discount Amount:", sales[0].d);
    console.log("Final Amount:", sales[0].f);
    console.log("t - d:", (Number(sales[0].t) - Number(sales[0].d)).toFixed(3));

    // Fix the discount_amount directly!
    await connection.execute(`
      UPDATE sales_orders
      SET discount_amount = total_amount - final_amount
      WHERE vendor_id = ? AND DATE(created_at) >= '2026-05-01' AND DATE(created_at) <= '2026-05-31'
    `, [vendorId]);

    console.log("Updated discount_amount = total_amount - final_amount");

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkDiscount();
