import pool from '../src/config/db';

async function main() {
  try {
    const query = `
      SELECT 
        v.vendor_id, 
        v.name_en as vendor_name, 
        SUM(CASE WHEN so.dispatch_status IN ('delivered', 'dispatched', 'in_transit', 'paid') THEN so.final_amount ELSE 0 END) as sales_performance,
        (
          SELECT SUM(w.quantity) 
          FROM wastage w 
          LEFT JOIN sales_returns r ON w.return_id = r.return_id
          WHERE (w.vendor_id = v.vendor_id OR r.vendor_id = v.vendor_id)
          AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_wastage_units,
        (
          SELECT SUM(w.quantity * COALESCE(mi.cost_price, 0)) 
          FROM wastage w 
          JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id
          LEFT JOIN sales_returns r ON w.return_id = r.return_id
          WHERE (w.vendor_id = v.vendor_id OR r.vendor_id = v.vendor_id)
          AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_loss_kwd,
        (
          SELECT SUM(so_inner.final_amount) 
          FROM sales_orders so_inner 
          WHERE so_inner.vendor_id = v.vendor_id 
          AND so_inner.dispatch_status IN ('delivered', 'dispatched', 'in_transit')
          AND so_inner.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_sales,
        (
          SELECT SUM(soi.quantity)
          FROM sales_order_items soi
          JOIN sales_orders s ON soi.sale_id = s.sale_id
          WHERE s.vendor_id = v.vendor_id
          AND s.dispatch_status IN ('delivered', 'dispatched', 'in_transit')
          AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_sold_units
      FROM vendors v
      LEFT JOIN sales_orders so ON v.vendor_id = so.vendor_id
      WHERE v.deleted_at IS NULL
      GROUP BY v.vendor_id
    `;
    const [rows]: any = await pool.execute(query);
    console.log("Rows returned:", rows.length);
    console.log("Sample row:", rows.find((r: any) => r.vendor_name === 'Canteen'));
  } catch (e: any) {
    console.error("SQL Error:", e.message, e);
  } finally {
    await pool.end();
  }
}

main();
