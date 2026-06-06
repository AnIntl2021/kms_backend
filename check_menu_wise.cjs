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
      SELECT mi.name_en as product_name, SUM(soi.quantity) as total_sold
      FROM sales_orders s
      JOIN sales_order_items soi ON s.sale_id = soi.sale_id
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      WHERE s.deleted_at IS NULL 
        AND (v.name_en LIKE '%Canteen%' OR s.customer_name LIKE '%Canteen%')
        AND s.created_at >= '2026-05-01 00:00:00' 
        AND s.created_at <= '2026-05-31 23:59:59'
        AND pb.name_en IN ('MEW Canteen', 'Canteen Jaber Stadium', 'Canteen Waha', 'Canteen Sideeq')
        AND mi.name_en IN (
          'Egg & Cheese Breakfast', 
          'Turkey Mozzarella Sandwich', 
          'Grill Chicken & Mushroom', 
          'Chicken Stroganoff', 
          'Halloumi Deli Sub'
        )
      GROUP BY mi.name_en
      ORDER BY total_sold DESC;
    `);
    
    console.log("==================================================");
    console.log("MAY SALES FOR 4 MAIN CANTEEN BRANCHES (UP TO 31ST):");
    console.log("==================================================");
    let total = 0;
    rows.forEach(r => {
      console.log(`${r.product_name.padEnd(30)} | ${Number(r.total_sold)} sold`);
      total += Number(r.total_sold);
    });
    console.log("--------------------------------------------------");
    console.log(`TOTAL`.padEnd(30) + ` | ${total} sold`);
    console.log("==================================================");
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
