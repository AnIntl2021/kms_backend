import dotenv from 'dotenv';
import path from 'path';

// Force load the backend's environment variables regardless of process.cwd()
dotenv.config({ path: path.resolve('c:/xampp/htdocs/fresh_n_fast_backend/.env.development') });
dotenv.config({ path: path.resolve('c:/xampp/htdocs/fresh_n_fast_backend/.env') });

import pool from '../src/config/db';

async function checkItem() {
  try {
    const [rows]: any = await pool.execute('SELECT * FROM inventory_items WHERE name_en LIKE "%Arzco%"');
    console.log('Arzco Item Details:', rows);
    
    if (rows.length > 0) {
      const [packages]: any = await pool.execute('SELECT * FROM inventory_item_packages WHERE inventory_item_id = ? AND deleted_at IS NULL', [rows[0].inventory_item_id]);
      console.log('Packages:', packages);
      
      const [batches]: any = await pool.execute('SELECT * FROM inventory_batches WHERE inventory_item_id = ? AND status = "active"', [rows[0].inventory_item_id]);
      console.log('Active Batches:', batches);
    }
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkItem();
