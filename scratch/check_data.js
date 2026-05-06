
const mysql = require('mysql2/promise');

async function dump() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'fresh_n_fast'
  });

  const [rows] = await connection.execute('SELECT sale_id, order_number, vendor_id, branch_id, customer_name FROM sales_orders ORDER BY sale_id DESC LIMIT 20');
  console.log(JSON.stringify(rows, null, 2));
  
  const [branches] = await connection.execute('SELECT branch_id, partner_id, name_en FROM partner_branches');
  console.log('Branches:', JSON.stringify(branches, null, 2));

  await connection.end();
}

dump();
