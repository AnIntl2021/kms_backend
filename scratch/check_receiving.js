const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'fresh_n_fast'
  });

  const [rows] = await conn.execute(
    'SELECT ii.name_en, ii.unit_en, ii.cost_price, SUM(poi.quantity) as total_qty, SUM(poi.quantity) * ii.cost_price as total_value ' +
    'FROM purchase_order_items poi ' +
    'JOIN purchase_orders po ON poi.purchase_id = po.purchase_id ' +
    'JOIN inventory_items ii ON poi.inventory_item_id = ii.inventory_item_id ' +
    "WHERE po.status = 'received' AND DATE(po.received_at) BETWEEN '2026-04-01' AND '2026-05-15' " +
    'GROUP BY ii.inventory_item_id, ii.name_en, ii.unit_en, ii.cost_price ' +
    'ORDER BY total_value DESC LIMIT 10'
  );

  console.log('\n=== Top 10 Items by Received Value (Apr 1 - May 15) ===');
  rows.forEach(r => {
    console.log(
      r.name_en.padEnd(35),
      '| qty:', Number(r.total_qty).toFixed(3).padStart(12), r.unit_en,
      '| cost_price:', Number(r.cost_price).toFixed(3),
      '| total_value:', Number(r.total_value).toFixed(3), 'KD'
    );
  });

  const [total] = await conn.execute(
    'SELECT SUM(poi.quantity * ii.cost_price) as grand_total ' +
    'FROM purchase_order_items poi ' +
    'JOIN purchase_orders po ON poi.purchase_id = po.purchase_id ' +
    'JOIN inventory_items ii ON poi.inventory_item_id = ii.inventory_item_id ' +
    "WHERE po.status = 'received' AND DATE(po.received_at) BETWEEN '2026-04-01' AND '2026-05-15'"
  );
  console.log('\n=== Grand Total Receiving Value ===', Number(total[0].grand_total).toFixed(3), 'KD');

  const [poCount] = await conn.execute(
    "SELECT COUNT(*) as cnt FROM purchase_orders WHERE status = 'received' AND DATE(received_at) BETWEEN '2026-04-01' AND '2026-05-15'"
  );
  console.log('=== Total Received POs in period ===', poCount[0].cnt);

  await conn.end();
}
check().catch(console.error);
