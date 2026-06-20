import pool from './src/config/db.js';
pool.execute(`
      SELECT soi.*, mi.name_en, mi.name_ar,
        (SELECT COALESCE(SUM(sri.quantity), 0)
         FROM sales_return_items sri
         JOIN sales_returns sr ON sri.return_id = sr.return_id
         WHERE sr.sale_id = soi.sale_id AND sri.menu_item_id = soi.menu_item_id) as returns_qty
      FROM sales_order_items soi
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      WHERE soi.sale_id IN (
         SELECT sale_id FROM sales_orders WHERE deleted_at IS NULL LIMIT 10
      )
`).then(res => { console.log(res[0]); process.exit(0); }).catch(console.error);
