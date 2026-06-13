import pool from './src/config/db.js';
pool.execute(`
      SELECT s.*, 
             IFNULL((SELECT SUM(sri.quantity) FROM sales_returns sr JOIN sales_return_items sri ON sr.return_id = sri.return_id WHERE sr.sale_id = s.sale_id), 0) as returns_qty
      FROM sales_orders s
      JOIN vendors v ON s.vendor_id = v.vendor_id
      WHERE s.deleted_at IS NULL AND v.type = 'client'
      AND DATE(s.created_at) BETWEEN '2026-05-01' AND '2026-05-31'
      HAVING returns_qty > 0
`).then(async (res) => {
    if (res[0].length === 0) {
        console.log('No returns found in May');
        process.exit(0);
    }
    const orderId = res[0][0].sale_id;
    console.log('Testing sale_id:', orderId);
    const items = await pool.execute(`
      SELECT soi.*, mi.name_en, mi.name_ar,
        (SELECT COALESCE(SUM(sri.quantity), 0)
         FROM sales_return_items sri
         JOIN sales_returns sr ON sri.return_id = sr.return_id
         WHERE sr.sale_id = soi.sale_id AND sri.menu_item_id = soi.menu_item_id) as returns_qty
      FROM sales_order_items soi
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      WHERE soi.sale_id = ?
  `, [orderId]);
    console.log(items[0]);
    process.exit(0);
}).catch(console.error);
