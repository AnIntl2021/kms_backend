import dotenv from 'dotenv';
import path from 'path';

// ES-Module-safe environment loading using process.cwd()
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import pool from '../src/config/db';

async function main() {
  try {
    console.log('🚀 Running database migration to add "yield_quantity" column to menu_items...');
    
    // Check if column already exists
    const [columns]: any = await pool.execute('DESCRIBE menu_items');
    const hasYield = columns.some((col: any) => col.Field === 'yield_quantity');
    
    if (hasYield) {
      console.log('✅ The "yield_quantity" column already exists in "menu_items" table!');
    } else {
      await pool.execute('ALTER TABLE menu_items ADD COLUMN yield_quantity DECIMAL(10,3) DEFAULT 1.000');
      console.log('🎉 SUCCESS: Added column "yield_quantity" to "menu_items" table successfully!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
