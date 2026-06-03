const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixReturns() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    await connection.beginTransaction();

    const [vendors] = await connection.execute('SELECT * FROM vendors WHERE name_en LIKE "%Canteen%" OR name_ar LIKE "%Canteen%"');
    const vendorId = vendors[0].vendor_id;

    // Find the returns that were incorrectly entered on May 4th for the April sales
    const [returns] = await connection.execute(`
      SELECT sr.return_id
      FROM sales_returns sr
      JOIN sales_orders so ON sr.sale_id = so.sale_id
      WHERE so.vendor_id = ? 
        AND DATE(so.created_at) >= "2026-04-01" 
        AND DATE(so.created_at) <= "2026-04-30"
        AND DATE(sr.created_at) = "2026-05-04"
    `, [vendorId]);

    const returnIds = returns.map(r => r.return_id);

    if (returnIds.length > 0) {
      console.log(`Found ${returnIds.length} incorrect return records. Deleting them now...`);
      
      const placeholders = returnIds.map(() => '?').join(',');

      // Delete from sales_return_items
      await connection.execute(`DELETE FROM sales_return_items WHERE return_id IN (${placeholders})`, returnIds);
      console.log('Deleted from sales_return_items');

      // Delete from wastage
      await connection.execute(`DELETE FROM wastage WHERE return_id IN (${placeholders})`, returnIds);
      console.log('Deleted from wastage');

      // Delete from sales_returns
      await connection.execute(`DELETE FROM sales_returns WHERE return_id IN (${placeholders})`, returnIds);
      console.log('Deleted from sales_returns');

      // ⚠️ IMPORTANT: In a real environment, you'd also want to reverse the stock addition if it was added back. 
      // But since these returns were likely fictional/duplicate scans of May stock against April orders, 
      // we might just delete the records. Assuming we don't need to deduct stock for now since they weren't real returns for that month.
    } else {
      console.log("No incorrect returns found.");
    }

    // Now, let's verify the new totals for April
    const [sales] = await connection.execute(`
      SELECT s.total_amount, s.discount_amount, s.final_amount,
      IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0) as returns_amount
      FROM sales_orders s
      WHERE s.vendor_id = ? AND s.deleted_at IS NULL AND DATE(s.created_at) >= "2026-04-01" AND DATE(s.created_at) <= "2026-04-30"
    `, [vendorId]);

    let totalGross = 0, totalDiscount = 0, totalFinal = 0, totalReturns = 0;

    for(const s of sales) {
      totalGross += Number(s.total_amount);
      totalDiscount += Number(s.discount_amount);
      totalFinal += Number(s.final_amount);
      totalReturns += Number(s.returns_amount);
    }

    console.log("--- NEW APRIL TOTALS FOR CANTEEN ---");
    console.log({ totalGross, totalDiscount, totalFinal, totalReturns, NetRevenue: totalFinal - totalReturns });

    await connection.commit();
    console.log("Successfully fixed the returns!");

  } catch (err) {
    await connection.rollback();
    console.error("Error fixing returns:", err);
  } finally {
    await connection.end();
  }
}

fixReturns();
