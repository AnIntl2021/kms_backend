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
    // 1. Get Dispatched Items
    const [dispatched] = await c.execute(`
      SELECT mi.name_en as menu_item, SUM(soi.quantity) as qty
      FROM sales_orders s
      JOIN sales_order_items soi ON s.sale_id = soi.sale_id
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      WHERE s.deleted_at IS NULL 
        AND (v.name_en LIKE '%Canteen%' OR s.customer_name LIKE '%Canteen%')
        AND s.created_at >= '2026-05-01 00:00:00' 
        AND s.created_at <= '2026-05-31 23:59:59'
        AND s.dispatch_status = 'delivered'
      GROUP BY mi.name_en
    `);

    // 2. Get Returned Items
    const [returned] = await c.execute(`
      SELECT mi.name_en as menu_item, SUM(sri.quantity) as qty
      FROM sales_returns sr
      JOIN sales_return_items sri ON sr.return_id = sri.return_id
      JOIN menu_items mi ON sri.menu_item_id = mi.menu_item_id
      JOIN sales_orders s ON sr.sale_id = s.sale_id
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      WHERE sr.deleted_at IS NULL
        AND (v.name_en LIKE '%Canteen%' OR s.customer_name LIKE '%Canteen%')
        AND s.created_at >= '2026-05-01 00:00:00' 
        AND s.created_at <= '2026-05-31 23:59:59'
      GROUP BY mi.name_en
    `);
    
    let dispatchMap = {};
    dispatched.forEach(r => dispatchMap[r.menu_item] = Number(r.qty));
    
    let returnMap = {};
    returned.forEach(r => returnMap[r.menu_item] = Number(r.qty));
    
    console.log("NET SOLD SANDWICHES (Dispatched - Returned):");
    console.log("==============================================");
    
    const targetProducts = [
      'Turkey Mozzarella Sandwich',
      'Halloumi Deli Sub 200g',
      'Grill Chicken & Mushroom 220g',
      'Egg & Cheese Chicken Mortadella 270g',
      'Chicken Stroganoff 225g'
    ];
    
    targetProducts.forEach(tp => {
      const sent = dispatchMap[tp] || 0;
      const ret = returnMap[tp] || 0;
      const net = sent - ret;
      console.log(`${tp.padEnd(36)} | Sent: ${String(sent).padEnd(4)} | Ret: ${String(ret).padEnd(4)} | NET: ${net}`);
    });
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
