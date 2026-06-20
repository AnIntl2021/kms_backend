import pool from '../src/config/db';
import { tenantContext } from '../src/middleware/tenantContext';

async function test() {
  const targetDb = 'kms_apple_1235'; 
  try {
    await tenantContext.run({ dbName: targetDb }, async () => {
      const [rows] = await pool.execute('SELECT * FROM system_settings');
      console.log('System Settings in DB:', rows);
    });
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();
