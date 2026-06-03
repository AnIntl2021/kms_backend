const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  const [vendors] = await connection.execute('SELECT * FROM vendors WHERE name_en LIKE "%Canteen%" OR name_ar LIKE "%Canteen%"');
  const vendorId = vendors[0].vendor_id;
  
  const [sales] = await connection.execute(`
    SELECT s.*, 
    IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0) as returns_amount
    FROM sales_orders s
    WHERE s.vendor_id = ? AND s.deleted_at IS NULL AND DATE(s.created_at) >= "2026-04-01" AND DATE(s.created_at) <= "2026-04-30"
  `, [vendorId]);

  console.log("Sales count:", sales.length);
  let totalGross = 0;
  let totalDiscount = 0;
  let totalFinal = 0;
  let totalReturns = 0;

  for(const s of sales) {
    totalGross += Number(s.total_amount);
    totalDiscount += Number(s.discount_amount);
    totalFinal += Number(s.final_amount);
    totalReturns += Number(s.returns_amount);
  }

  console.log({ totalGross, totalDiscount, totalFinal, totalReturns });

  await connection.end();
}

check().catch(console.error);
