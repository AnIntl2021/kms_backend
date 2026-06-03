const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMayReturnValues() {
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

    // Get all May returns for Canteen
    const [returns] = await connection.execute(`
      SELECT r.return_id, r.total_credit_amount
      FROM sales_returns r
      WHERE r.vendor_id = ? 
      AND DATE(r.created_at) >= '2026-05-01' 
      AND DATE(r.created_at) <= '2026-05-31'
    `, [vendorId]);

    let updatedCount = 0;

    for (const ret of returns) {
      // Calculate correct credit value (sum of quantity * unit_price * 0.65)
      const [items] = await connection.execute(`
        SELECT SUM(ri.quantity * mi.price * 0.65) as correct_credit
        FROM sales_return_items ri
        JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
        WHERE ri.return_id = ?
      `, [ret.return_id]);

      const correctCredit = items[0].correct_credit || 0;

      // Only update if it's incorrect (allowing tiny rounding differences)
      if (Math.abs(Number(ret.total_credit_amount) - Number(correctCredit)) > 0.01) {
        await connection.execute(`
          UPDATE sales_returns
          SET total_credit_amount = ?
          WHERE return_id = ?
        `, [correctCredit.toFixed(3), ret.return_id]);
        
        console.log(`Fixed Return #${ret.return_id}: was ${ret.total_credit_amount}, now ${correctCredit.toFixed(3)}`);
        updatedCount++;
      }
    }

    await connection.commit();
    console.log(`Successfully fixed values for ${updatedCount} incorrectly priced returns!`);

  } catch (err) {
    await connection.rollback();
    console.error("Error fixing return values:", err);
  } finally {
    await connection.end();
  }
}

fixMayReturnValues();
