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
             soi.quantity, mi.name_en as product_name, pb.name_en as branch_name
      FROM sales_orders s
      JOIN sales_order_items soi ON s.sale_id = soi.sale_id
      LEFT JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      WHERE s.deleted_at IS NULL AND v.name_en = 'Canteen'
    `);
    
    let stats = {
      'Egg & Cheese Breakfast': 0,
      'Turkey Mozzarella Sandwich': 0,
      'Grill Chicken & Mushroom': 0,
      'Chicken Stroganoff': 0,
      'Halloumi Deli Sub': 0
    };
    
    let totalItems = 0;

    rows.forEach(r => {
      let matchedProduct = null;
      Object.keys(stats).forEach(tp => {
        if (r.product_name && r.product_name.includes(tp)) matchedProduct = tp;
      });
      if (!matchedProduct) return;

      const dDate = r.dispatch_date;
      
      // UP TO MAY 31ST
      if (dDate >= '2026-05-01' && dDate <= '2026-05-31') {
        const b = r.branch_name;
        if (b === 'MEW Canteen' || b === 'Canteen Jaber Stadium' || b === 'Canteen Waha' || b === 'Canteen Sideeq') {
          stats[matchedProduct] += Number(r.quantity);
          totalItems += Number(r.quantity);
        }
      }
    });
    
    console.log("==================================================");
    console.log("MAY SALES FOR 4 MAIN CANTEEN BRANCHES (UP TO 31ST):");
    console.log("==================================================");
    Object.keys(stats).forEach(k => {
      console.log(`${k.padEnd(30)} | ${stats[k]} sold`);
    });
    console.log("--------------------------------------------------");
    console.log(`TOTAL`.padEnd(30) + ` | ${totalItems} sold`);
    console.log("==================================================");
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
