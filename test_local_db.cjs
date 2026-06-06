const mysql = require('mysql2/promise');
require('dotenv').config({path: '.env.local'}); // use local env to connect to local DB!

async function run() {
  const c = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'fresh_n_fast'
  });

  try {
    const [rows] = await c.execute("SELECT sale_id, created_at, DATE_FORMAT(created_at, '%Y-%m-%d') as dispatch_date FROM sales_orders WHERE vendor_id = 4 AND created_at >= '2026-04-30' AND created_at <= '2026-06-02'");
    console.log("Local DB Sales:");
    console.log(rows.filter(r => new Date(r.created_at).getMonth() !== 4)); // Log non-May sales
    
    let mayCount = 0;
    rows.forEach(r => {
      if(new Date(r.created_at).getMonth() === 4) mayCount++;
    });
    console.log("May sales count:", mayCount);
  } catch (e) {
    console.error(e);
  } finally {
    if(c) await c.end();
  }
}
run();
