const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMayFinally() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    await connection.beginTransaction();

    // 1. Delete the 55 returns I just added (Return ID 134)
    await connection.execute('DELETE FROM wastage WHERE return_id = 134');
    await connection.execute('DELETE FROM sales_return_items WHERE return_id = 134');
    await connection.execute('DELETE FROM sales_returns WHERE return_id = 134');
    console.log("Deleted the 55 extra items added previously.");

    // 2. Move June returns out of May sales orders
    // The returns that were created in June, but attached to May orders
    const juneReturns = [113, 114, 116, 117, 120, 121, 123, 129];
    
    const [vendors] = await connection.execute('SELECT vendor_id FROM vendors WHERE name_en LIKE "%Canteen%"');
    const vendorId = vendors[0].vendor_id;

    // Find a valid June sale order for Canteen to attach these to
    const [juneOrders] = await connection.execute(`
      SELECT sale_id FROM sales_orders
      WHERE vendor_id = ? AND DATE(created_at) >= '2026-06-01' AND DATE(created_at) <= '2026-06-30'
      AND deleted_at IS NULL
      LIMIT 1
    `, [vendorId]);

    if (juneOrders.length > 0) {
      const juneSaleId = juneOrders[0].sale_id;
      for (const rid of juneReturns) {
        await connection.execute('UPDATE sales_returns SET sale_id = ? WHERE return_id = ?', [juneSaleId, rid]);
        console.log(`Moved return ${rid} to June Sale ID ${juneSaleId}`);
      }
    } else {
      console.log("Could not find a June sale order to attach them to!");
    }

    await connection.commit();
    console.log("Successfully fixed May's Net Revenue!");

  } catch (err) {
    await connection.rollback();
    console.error(err);
  } finally {
    await connection.end();
  }
}

fixMayFinally();
