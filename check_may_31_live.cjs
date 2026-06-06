const mysql = require('mysql2/promise');
require('dotenv').config(); // Load the default .env which has the live credentials!

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await c.execute("SELECT sale_id, created_at, total_amount, dispatch_status FROM sales_orders WHERE vendor_id = 4 AND created_at >= '2026-05-31 00:00:00' AND created_at <= '2026-05-31 23:59:59' ORDER BY created_at ASC");
    
    console.log("==========================================");
    console.log(`FOUND ${rows.length} SALES EXACTLY ON MAY 31ST:`);
    console.log("==========================================");
    
    let totalValue = 0;
    rows.forEach((row, i) => {
      console.log(`${i+1}. Sale ID: ${row.sale_id} | Time: ${new Date(row.created_at).toISOString()} | Amount: ${row.total_amount} KD | Status: ${row.dispatch_status}`);
      totalValue += Number(row.total_amount);
    });
    
    console.log("==========================================");
    console.log(`TOTAL VALUE OF MAY 31ST SALES: ${totalValue.toFixed(3)} KD`);
    console.log("==========================================");

  } catch (e) {
    console.error("Error querying database:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
