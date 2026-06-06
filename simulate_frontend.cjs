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
    const [rows] = await c.execute(`
      SELECT s.sale_id, s.created_at, s.total_amount, s.dispatch_status, s.final_amount,
             DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
             v.name_en as client_name
      FROM sales_orders s
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      WHERE s.deleted_at IS NULL AND (v.name_en LIKE '%Canteen%' OR s.customer_name LIKE '%Canteen%')
    `);
    
    console.log(`TOTAL CANTEEN SALES IN DB: ${rows.length}`);
    
    // Simulate what the frontend dashboard does!
    let dashboardMaySales = 0;
    let dashboardMayValue = 0;
    
    let dashboard30Sales = 0;
    let dashboard30Value = 0;

    rows.forEach(r => {
      // Dispatch Dashboard local parsing simulation
      const d = new Date(r.dispatch_date || r.created_at);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dDate = `${year}-${month}-${day}`;
      
      if (dDate >= '2026-05-01' && dDate <= '2026-05-31') {
        dashboardMaySales++;
        dashboardMayValue += Number(r.final_amount || r.total_amount || 0);
      }
      
      if (dDate >= '2026-05-01' && dDate <= '2026-05-30') {
        dashboard30Sales++;
        dashboard30Value += Number(r.final_amount || r.total_amount || 0);
      }
    });
    
    console.log(`If UI Date = May 31: ${dashboardMaySales} sales, ${dashboardMayValue.toFixed(3)} KD`);
    console.log(`If UI Date = May 30: ${dashboard30Sales} sales, ${dashboard30Value.toFixed(3)} KD`);
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
