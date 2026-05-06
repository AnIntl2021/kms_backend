
import mysql from 'mysql2/promise';

async function checkVendors() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'fresh_n_fast_db'
    });

    const [rows] = await connection.execute('SELECT vendor_id, name_en FROM vendors ORDER BY vendor_id DESC');
    console.log('--- Vendors ---');
    console.log(JSON.stringify(rows, null, 2));

    await connection.end();
  } catch (err) {
    console.error(err);
  }
}

checkVendors();
