import pool from './src/config/db.js';

async function test() {
  try {
    console.log("Testing Food Cost Report queries...");
    const start = '2026-05-01';
    const end = '2026-05-31';

    // Query 1: Active items
    const [items] = await pool.execute(`
      SELECT ii.inventory_item_id, ii.name_en, ii.name_ar, ii.sku, ii.current_stock, ii.min_stock_level, ii.unit_en, ii.unit_ar, ii.cost_price,
      c.name_en as category_name
      FROM inventory_items ii
      LEFT JOIN categories c ON ii.category_id = c.category_id
      WHERE ii.deleted_at IS NULL
      ORDER BY c.name_en ASC, ii.name_en ASC
    `);
    console.log(`Found ${items.length} inventory items.`);

    if (items.length > 0) {
      const item = items[0];
      const itemId = item.inventory_item_id;

      // Query 2: Receiving
      const [receivingRows] = await pool.execute(`
        SELECT SUM(poi.quantity) as total_qty
        FROM purchase_order_items poi
        JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
        WHERE poi.inventory_item_id = ?
          AND po.status = 'received'
          AND DATE(po.received_at) BETWEEN ? AND ?
      `, [itemId, start, end]);
      console.log(`Receiving qty for item ${itemId}:`, receivingRows[0]?.total_qty);

      // Query 3: Wastage
      const [wastageRows] = await pool.execute(`
        SELECT SUM(w.quantity) as total_qty
        FROM wastage w
        WHERE w.inventory_item_id = ?
          AND w.deleted_at IS NULL
          AND DATE(w.created_at) BETWEEN ? AND ?
      `, [itemId, start, end]);
      console.log(`Wastage qty for item ${itemId}:`, wastageRows[0]?.total_qty);

      // Query 4: Production
      const [productionRows] = await pool.execute(`
        SELECT SUM(pi.quantity_produced * mii.quantity * IFNULL(iip.multiplier, 1)) as total_qty
        FROM production_items pi
        JOIN production_logs pl ON pi.production_id = pl.production_id
        JOIN menu_item_ingredients mii ON pi.menu_item_id = mii.menu_item_id
        LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
        WHERE mii.inventory_item_id = ?
          AND pl.deleted_at IS NULL
          AND DATE(pl.production_date) BETWEEN ? AND ?
      `, [itemId, start, end]);
      console.log(`Production usage qty for item ${itemId}:`, productionRows[0]?.total_qty);
    }

    const [salesRows] = await pool.execute(`
      SELECT SUM(final_amount) as revenue
      FROM sales_orders
      WHERE deleted_at IS NULL
        AND DATE(created_at) BETWEEN ? AND ?
    `, [start, end]);
    console.log(`Sales revenue:`, salesRows[0]?.revenue);

    console.log("All queries executed successfully without crashing!");
  } catch (error) {
    console.error("CRITICAL ERROR IN QUERY EXECUTION:", error);
  } finally {
    process.exit(0);
  }
}

test();
