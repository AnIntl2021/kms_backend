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
    const [dispatched] = await c.execute(`
      SELECT mi.name_en as menu_item, SUM(soi.quantity) as qty
      FROM sales_orders s
      JOIN sales_order_items soi ON s.sale_id = soi.sale_id
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      WHERE s.deleted_at IS NULL 
        AND pb.name_en IN ('MEW Canteen', 'Canteen Jaber Stadium', 'Canteen Waha', 'Canteen Sideeq')
        AND s.created_at >= '2026-05-01 00:00:00' 
        AND s.created_at <= '2026-05-31 23:59:59'
        AND s.dispatch_status = 'delivered'
      GROUP BY mi.name_en
    `);

    const [returned] = await c.execute(`
      SELECT mi.name_en as menu_item, SUM(sri.quantity) as qty
      FROM sales_returns sr
      JOIN sales_return_items sri ON sr.return_id = sri.return_id
      JOIN menu_items mi ON sri.menu_item_id = mi.menu_item_id
      JOIN sales_orders s ON sr.sale_id = s.sale_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      WHERE sr.deleted_at IS NULL
        AND pb.name_en IN ('MEW Canteen', 'Canteen Jaber Stadium', 'Canteen Waha', 'Canteen Sideeq')
        AND s.created_at >= '2026-05-01 00:00:00' 
        AND s.created_at <= '2026-05-31 23:59:59'
      GROUP BY mi.name_en
    `);
    
    let dispatchMap = {};
    dispatched.forEach(r => {
      let matched = null;
      if (r.menu_item.includes('Turkey Mozzarella')) matched = 'Turkey Mozzarella';
      else if (r.menu_item.includes('Halloumi Deli Sub')) matched = 'Halloumi Deli Sub';
      else if (r.menu_item.includes('Grill Chicken')) matched = 'Grill Chicken & Mushroom';
      else if (r.menu_item.includes('Egg & Cheese')) matched = 'Egg & Cheese';
      else if (r.menu_item.includes('Chicken Stroganoff')) matched = 'Chicken Stroganoff';
      if (matched) dispatchMap[matched] = (dispatchMap[matched]||0) + Number(r.qty);
    });
    
    let returnMap = {};
    returned.forEach(r => {
      let matched = null;
      if (r.menu_item.includes('Turkey Mozzarella')) matched = 'Turkey Mozzarella';
      else if (r.menu_item.includes('Halloumi Deli Sub')) matched = 'Halloumi Deli Sub';
      else if (r.menu_item.includes('Grill Chicken')) matched = 'Grill Chicken & Mushroom';
      else if (r.menu_item.includes('Egg & Cheese')) matched = 'Egg & Cheese';
      else if (r.menu_item.includes('Chicken Stroganoff')) matched = 'Chicken Stroganoff';
      if (matched) returnMap[matched] = (returnMap[matched]||0) + Number(r.qty);
    });
    
    console.log("NET SOLD SANDWICHES (4 MAIN BRANCHES, MAY 1-31):");
    
    const targetProducts = [
      'Turkey Mozzarella',
      'Halloumi Deli Sub',
      'Grill Chicken & Mushroom',
      'Egg & Cheese',
      'Chicken Stroganoff'
    ];
    
    targetProducts.forEach(tp => {
      const sent = dispatchMap[tp] || 0;
      const ret = returnMap[tp] || 0;
      const net = sent - ret;
      console.log(`${tp.padEnd(30)} | Sent: ${String(sent).padEnd(4)} | Ret: ${String(ret).padEnd(4)} | NET: ${net}`);
    });
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
