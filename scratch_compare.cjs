const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDates() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    timezone: 'Z' // Query in UTC
  });

  const connectionLocal = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    timezone: 'local' // Query in local time
  });

  const query = `
    SELECT SUM(total_credit_amount) as total
    FROM sales_returns 
    WHERE vendor_id = (SELECT vendor_id FROM vendors WHERE name_en LIKE "%Canteen%")
    AND DATE(created_at) >= '2026-05-01' 
    AND DATE(created_at) <= '2026-05-31'
  `;

  const [utcResult] = await connection.execute(query);
  const [localResult] = await connectionLocal.execute(query);

  console.log("UTC Timezone Total Returns:", utcResult[0].total);
  console.log("Local Timezone Total Returns:", localResult[0].total);
  
  process.exit(0);
}
checkDates();
