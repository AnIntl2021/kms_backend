const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await c.execute("SELECT sale_id, created_at, total_amount, dispatch_status FROM sales_orders WHERE vendor_id = 4 AND created_at >= '2026-05-01 00:00:00' AND created_at <= '2026-05-31 23:59:59' ORDER BY created_at ASC");
    
    console.log(`FOUND ${rows.length} SALES IN MAY:`);
    
    let totalGross = 0;
    let deliveredGross = 0;
    let cancelledGross = 0;

    rows.forEach((row) => {
      totalGross += Number(row.total_amount);
      if (row.dispatch_status === 'delivered') deliveredGross += Number(row.total_amount);
      else cancelledGross += Number(row.total_amount);
    });
    
    console.log(`TOTAL GROSS: ${totalGross.toFixed(3)} KD`);
    console.log(`DELIVERED GROSS: ${deliveredGross.toFixed(3)} KD`);
    console.log(`CANCELLED/OTHER GROSS: ${cancelledGross.toFixed(3)} KD`);

  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
