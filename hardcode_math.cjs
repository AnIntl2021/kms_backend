const mysql = require('mysql2/promise');
require('dotenv').config();

async function hardcodeMath() {
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

    // Hardcoded exact prices from Canteen Excel
    const exactPrices = {
      'Egg & Cheese Chicken Mortadella 270g': 1.073,
      'Turkey Mozzarella Sandwich': 1.203,
      'Grill Chicken & Mushroom 220g': 1.365,
      'Chicken Stroganoff 225g': 1.268,
      'Halloumi Deli Sub 200g': 1.073
    };

    // 1. Recalculate Sales Orders Final Amounts properly
    const [orders] = await connection.execute(`
      SELECT sale_id FROM sales_orders
      WHERE vendor_id = ? AND DATE(created_at) >= '2026-05-01' AND DATE(created_at) <= '2026-05-31'
    `, [vendorId]);

    for (const order of orders) {
      const [items] = await connection.execute(`
        SELECT soi.quantity, mi.name_en 
        FROM sales_order_items soi
        JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
        WHERE soi.sale_id = ?
      `, [order.sale_id]);

      let newFinalAmount = 0;
      for (const item of items) {
        const exactPrice = exactPrices[item.name_en] || 0;
        newFinalAmount += (item.quantity * exactPrice);
      }

      await connection.execute(`
        UPDATE sales_orders SET final_amount = ? WHERE sale_id = ?
      `, [newFinalAmount.toFixed(3), order.sale_id]);
    }

    // 2. Recalculate Sales Returns Credit Amounts properly
    const [returns] = await connection.execute(`
      SELECT r.return_id
      FROM sales_returns r
      WHERE r.vendor_id = ? AND DATE(r.created_at) >= '2026-05-01' AND DATE(r.created_at) <= '2026-05-31'
    `, [vendorId]);

    for (const ret of returns) {
      const [items] = await connection.execute(`
        SELECT ri.quantity, mi.name_en 
        FROM sales_return_items ri
        JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
        WHERE ri.return_id = ?
      `, [ret.return_id]);

      let newCreditAmount = 0;
      for (const item of items) {
        const exactPrice = exactPrices[item.name_en] || 0;
        newCreditAmount += (item.quantity * exactPrice);
      }

      await connection.execute(`
        UPDATE sales_returns SET total_credit_amount = ? WHERE return_id = ?
      `, [newCreditAmount.toFixed(3), ret.return_id]);
    }

    await connection.commit();
    console.log("Successfully hardcoded exact Excel math!");

  } catch (err) {
    await connection.rollback();
    console.error(err);
  } finally {
    await connection.end();
  }
}

hardcodeMath();
