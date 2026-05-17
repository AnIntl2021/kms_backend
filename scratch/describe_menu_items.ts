import dotenv from 'dotenv';
import path from 'path';

// ES-Module-safe environment loading using process.cwd()
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import pool from '../src/config/db';

async function main() {
  try {
    console.log('🔍 Checking columns of menu_items...');
    const [columns]: any = await pool.execute('DESCRIBE menu_items');
    console.table(columns);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
