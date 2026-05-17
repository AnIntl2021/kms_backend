import pool from '../src/config/db';

async function checkSchema() {
  try {
    console.log('--- inventory_items ---');
    const [invCols]: any = await pool.execute('SHOW COLUMNS FROM inventory_items');
    console.table(invCols);

    console.log('--- menu_items ---');
    const [menuCols]: any = await pool.execute('SHOW COLUMNS FROM menu_items');
    console.table(menuCols);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkSchema();
