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
             soi.quantity, mi.name_en as product_name
      FROM sales_orders s
      JOIN sales_order_items soi ON s.sale_id = soi.sale_id
      LEFT JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      WHERE s.deleted_at IS NULL AND (v.name_en LIKE '%Canteen%' OR s.customer_name LIKE '%Canteen%')
    `);
    
    let items31 = 0;
    let items30 = 0;
    
    const targetProducts = [
      'Egg & Cheese Breakfast',
      'Turkey Mozzarella Sandwich',
      'Grill Chicken & Mushroom',
      'Chicken Stroganoff',
      'Halloumi Deli Sub'
    ];

    rows.forEach(r => {
      let isTarget = false;
      targetProducts.forEach(tp => {
        if (r.product_name && r.product_name.includes(tp)) isTarget = true;
      });
      
      if (!isTarget) return;

      const d = new Date(r.dispatch_date || r.created_at);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dDate = `${year}-${month}-${day}`;
      
      if (dDate >= '2026-05-01' && dDate <= '2026-05-31') {
        items31 += Number(r.quantity);
      }
      if (dDate >= '2026-05-01' && dDate <= '2026-05-30') {
        items30 += Number(r.quantity);
      }
    });
    
    console.log(`TOTAL OF THOSE 5 SANDWICHES SOLD IN MAY (Up to May 31): ${items31}`);
    console.log(`TOTAL OF THOSE 5 SANDWICHES SOLD IN MAY (Up to May 30): ${items30}`);
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
