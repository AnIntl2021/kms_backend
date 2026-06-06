const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    const [rows] = await c.execute("SHOW TABLES LIKE '%return%'");
    console.log("Return tables:", rows);
    const [rows2] = await c.execute("SHOW TABLES LIKE '%wast%'");
    console.log("Wastage tables:", rows2);
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    if(c) await c.end();
  }
}
run();
