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
      SELECT s.sale_id, DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
             soi.quantity, mi.name_en as product_name
      FROM sales_orders s
      JOIN sales_order_items soi ON s.sale_id = soi.sale_id
      LEFT JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      WHERE s.deleted_at IS NULL 
        AND (v.name_en LIKE '%Canteen%' OR s.customer_name LIKE '%Canteen%')
        AND s.dispatch_status = 'delivered'
    `);
    
    let totalItems = 0;
    
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

      const dDate = r.dispatch_date;
      
      if (dDate >= '2026-05-01' && dDate <= '2026-05-31') {
        totalItems += Number(r.quantity);
      }
    });
    
    console.log(`TOTAL DELIVERED SANDWICHES SOLD IN MAY: ${totalItems}`);
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
