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
      SELECT s.sale_id, s.created_at, DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
             SUM(soi.quantity) as total_items
      FROM sales_orders s
      JOIN sales_order_items soi ON s.sale_id = soi.sale_id
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      WHERE s.deleted_at IS NULL AND (v.name_en LIKE '%Canteen%' OR s.customer_name LIKE '%Canteen%')
      GROUP BY s.sale_id
    `);
    
    let items31 = 0;
    let items30 = 0;

    rows.forEach(r => {
      const d = new Date(r.dispatch_date || r.created_at);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dDate = `${year}-${month}-${day}`;
      
      if (dDate >= '2026-05-01' && dDate <= '2026-05-31') {
        items31 += Number(r.total_items);
      }
      if (dDate >= '2026-05-01' && dDate <= '2026-05-30') {
        items30 += Number(r.total_items);
      }
    });
    
    console.log(`TOTAL ITEMS SOLD IN MAY (Up to May 31): ${items31}`);
    console.log(`TOTAL ITEMS SOLD IN MAY (Up to May 30): ${items30}`);
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
