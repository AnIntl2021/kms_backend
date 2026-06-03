const mysql = require('mysql2/promise');
require('dotenv').config();

async function recalculateMay() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    await connection.beginTransaction();

    const [vendors] = await connection.execute('SELECT vendor_id FROM vendors WHERE name_en LIKE "%Canteen%"');
    const vendorId = vendors[0].vendor_id;

    // 1. Recalculate Sales Orders Final Amounts
    const [orders] = await connection.execute(`
      SELECT sale_id, discount_percentage FROM sales_orders
      WHERE vendor_id = ? AND DATE(created_at) >= '2026-05-01' AND DATE(created_at) <= '2026-05-31'
    `, [vendorId]);

    for (const order of orders) {
      const discountFactor = (100 - Number(order.discount_percentage || 25)) / 100;
      
      const [items] = await connection.execute(`
        SELECT soi.quantity, mi.price 
        FROM sales_order_items soi
        JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
        WHERE soi.sale_id = ?
      `, [order.sale_id]);

      let newFinalAmount = 0;
      for (const item of items) {
        // Apply user's logic: round unit price to 3 decimals FIRST
        const discountedPrice = Math.round((Number(item.price) * discountFactor) * 1000) / 1000;
        newFinalAmount += (item.quantity * discountedPrice);
      }

      await connection.execute(`
        UPDATE sales_orders SET final_amount = ? WHERE sale_id = ?
      `, [newFinalAmount.toFixed(3), order.sale_id]);
    }

    // 2. Recalculate Sales Returns Credit Amounts
    const [returns] = await connection.execute(`
      SELECT r.return_id, s.discount_percentage
      FROM sales_returns r
      JOIN sales_orders s ON r.sale_id = s.sale_id
      WHERE r.vendor_id = ? AND DATE(r.created_at) >= '2026-05-01' AND DATE(r.created_at) <= '2026-05-31'
    `, [vendorId]);

    for (const ret of returns) {
      const discountFactor = (100 - Number(ret.discount_percentage || 25)) / 100;

      const [items] = await connection.execute(`
        SELECT ri.quantity, mi.price 
        FROM sales_return_items ri
        JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
        WHERE ri.return_id = ?
      `, [ret.return_id]);

      let newCreditAmount = 0;
      for (const item of items) {
        const discountedPrice = Math.round((Number(item.price) * discountFactor) * 1000) / 1000;
        newCreditAmount += (item.quantity * discountedPrice);
      }

      await connection.execute(`
        UPDATE sales_returns SET total_credit_amount = ? WHERE return_id = ?
      `, [newCreditAmount.toFixed(3), ret.return_id]);
    }

    await connection.commit();
    console.log("Successfully recalculated May with 3-decimal rounding!");

  } catch (err) {
    await connection.rollback();
    console.error(err);
  } finally {
    await connection.end();
  }
}

recalculateMay();
