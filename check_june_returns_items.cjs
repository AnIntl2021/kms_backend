const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkJuneReturnItems() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await connection.execute(`
      SELECT 
        mi.name_en, 
        SUM(ri.quantity) as qty
      FROM sales_returns r
      JOIN sales_return_items ri ON r.return_id = ri.return_id
      JOIN sales_orders s ON r.sale_id = s.sale_id
      JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
      WHERE DATE(r.created_at) > '2026-05-31' 
      AND DATE(s.created_at) >= '2026-05-01'
      AND DATE(s.created_at) <= '2026-05-31'
      GROUP BY mi.menu_item_id
    `);

    console.log("June Returns for May Sales:");
    console.table(rows);

  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

checkJuneReturnItems();
