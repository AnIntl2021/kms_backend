const mysql = require('mysql2/promise');
require('dotenv').config({path: '.env.production'});

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await c.execute("SELECT sale_id, created_at, total_amount, dispatch_status FROM sales_orders WHERE vendor_id = 4 AND created_at >= '2026-05-30' AND created_at <= '2026-06-02'");
    console.log("Here are the actual database timestamps for late May / early June sales:");
    console.log(rows);
  } finally {
    await c.end();
  }
}

run();
