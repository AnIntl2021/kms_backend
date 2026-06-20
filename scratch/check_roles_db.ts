import pool from '../src/config/db';
import { tenantContext } from '../src/middleware/tenantContext';

async function check() {
  await tenantContext.run({ dbName: 'kms_apple_1235' }, async () => {
    try {
      const [admins]: any = await pool.execute('SELECT * FROM admins');
      console.log('Admins:', admins);
      const [roles]: any = await pool.execute('SELECT * FROM roles');
      console.log('Roles:', roles);
    } catch (err: any) {
      console.error(err);
    }
  });
  process.exit(0);
}
check();
