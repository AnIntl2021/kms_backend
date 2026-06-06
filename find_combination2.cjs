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
      SELECT mi.name_en as menu_item, SUM(soi.quantity) as qty, pb.name_en as branch, DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date
      FROM sales_orders s
      JOIN sales_order_items soi ON s.sale_id = soi.sale_id
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      WHERE s.deleted_at IS NULL 
        AND (v.name_en LIKE '%Canteen%' OR s.customer_name LIKE '%Canteen%')
        AND s.created_at >= '2026-05-01 00:00:00' 
        AND s.created_at <= '2026-05-30 23:59:59'
        AND s.dispatch_status = 'delivered'
      GROUP BY mi.name_en, pb.name_en, dispatch_date
    `);
    
    let branchStats = {}; 

    rows.forEach(r => {
      let matchedItem = null;
      if (r.menu_item.includes('Turkey Mozzarella')) matchedItem = 'Turkey Mozzarella';
      else if (r.menu_item.includes('Halloumi Deli Sub')) matchedItem = 'Halloumi Deli Sub';
      else if (r.menu_item.includes('Grill Chicken')) matchedItem = 'Grill Chicken & Mushroom';
      else if (r.menu_item.includes('Egg & Cheese')) matchedItem = 'Egg & Cheese';
      else if (r.menu_item.includes('Chicken Stroganoff')) matchedItem = 'Chicken Stroganoff';
      
      if (!matchedItem) return;

      const branch = r.branch || 'Unknown';
      if (!branchStats[branch]) branchStats[branch] = { 
        'Turkey Mozzarella': 0, 'Halloumi Deli Sub': 0, 'Grill Chicken & Mushroom': 0, 'Egg & Cheese': 0, 'Chicken Stroganoff': 0 
      };
      
      branchStats[branch][matchedItem] += Number(r.qty);
    });

    console.log("Branch Totals (May 1 - 30):");
    console.table(branchStats);
    
    let tMozz = 0, tHal = 0, tGrill = 0, tEgg = 0, tStrog = 0;
    ['MEW Canteen', 'Canteen Jaber Stadium', 'Canteen Waha', 'Canteen Sideeq'].forEach(b => {
      tMozz += branchStats[b]['Turkey Mozzarella'];
      tHal += branchStats[b]['Halloumi Deli Sub'];
      tGrill += branchStats[b]['Grill Chicken & Mushroom'];
      tEgg += branchStats[b]['Egg & Cheese'];
      tStrog += branchStats[b]['Chicken Stroganoff'];
    });
    console.log("SUM OF 4 MAIN BRANCHES:");
    console.log(`Turkey: ${tMozz}, Halloumi: ${tHal}, Grill: ${tGrill}, Egg: ${tEgg}, Stroganoff: ${tStrog}`);

  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
