import pool from '../src/config/db';

async function checkUnsigned() {
  try {
    const [invRows]: any = await pool.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_NAME = 'inventory_items' AND COLUMN_NAME = 'current_stock'");
    console.log('inventory_items.current_stock type:', invRows[0]?.COLUMN_TYPE);

    const [menuRows]: any = await pool.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_NAME = 'menu_items' AND COLUMN_NAME = 'current_stock'");
    console.log('menu_items.current_stock type:', menuRows[0]?.COLUMN_TYPE);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkUnsigned();
