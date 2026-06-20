import pool from '../src/config/db';
import { tenantContext } from '../src/middleware/tenantContext';

async function test() {
  await tenantContext.run({ dbName: 'kms_apple_1235' }, async () => {
    try {
      // Test insert
      const [result]: any = await pool.execute(
        'INSERT INTO categories (name_en, name_ar, sort_order, parent_id) VALUES (?, ?, ?, ?)',
        ['Test Eng', 'برجر', 0, null]
      );
      console.log('✅ Insert Category success! ID:', result.insertId);
      
      // Clean up
      await pool.execute('DELETE FROM categories WHERE category_id = ?', [result.insertId]);
    } catch (err: any) {
      console.error('❌ Insert Category failed with SQL error:', err.message);
    }
  });
  process.exit(0);
}

test();
