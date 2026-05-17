import dotenv from 'dotenv';
import path from 'path';

// ES-Module-safe environment loading using process.cwd()
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import pool from '../src/config/db';

async function main() {
  try {
    console.log('🔍 Querying live "Black olives" details...');
    const [items]: any = await pool.execute('SELECT * FROM inventory_items WHERE name_en LIKE "%olives%"');
    console.log('\n--- Item Details ---');
    console.log(items);
    
    if (items.length > 0) {
      const itemId = items[0].inventory_item_id;
      
      const [packages]: any = await pool.execute('SELECT * FROM inventory_item_packages WHERE inventory_item_id = ? AND deleted_at IS NULL', [itemId]);
      console.log('\n--- Packages ---');
      console.log(packages);
      
      const [batches]: any = await pool.execute('SELECT * FROM inventory_batches WHERE inventory_item_id = ? AND status = "active"', [itemId]);
      console.log('\n--- Active Batches ---');
      console.log(batches);
    } else {
      console.log('❌ Item not found.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
