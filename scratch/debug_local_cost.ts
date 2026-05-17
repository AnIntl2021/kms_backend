import mysql from 'mysql2/promise';

async function checkLocalItem() {
  try {
    console.log('🔌 Connecting to Local MySQL (localhost)...');
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'fresh_n_fast_db'
    });
    
    console.log('✅ Connected to Local DB!');
    
    const [rows]: any = await connection.execute('SELECT * FROM inventory_items WHERE name_en LIKE "%Arzco%"');
    console.log('Arzco Item Details:', rows);
    
    if (rows.length > 0) {
      const [packages]: any = await connection.execute('SELECT * FROM inventory_item_packages WHERE inventory_item_id = ? AND deleted_at IS NULL', [rows[0].inventory_item_id]);
      console.log('Packages:', packages);
      
      const [batches]: any = await connection.execute('SELECT * FROM inventory_batches WHERE inventory_item_id = ? AND status = "active"', [rows[0].inventory_item_id]);
      console.log('Active Batches:', batches);
    }
    
    await connection.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Connection Failed:', error.message);
    process.exit(1);
  }
}

checkLocalItem();
