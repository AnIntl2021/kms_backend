import pool from './src/config/db';

async function checkSchema() {
  try {
    const [columns]: any = await pool.execute('DESCRIBE categories');
    console.log('Categories Table Columns:');
    columns.forEach((col: any) => console.log(`- ${col.Field}: ${col.Type}`));
  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    process.exit();
  }
}

checkSchema();
