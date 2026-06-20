import pool from '../src/config/db';
import { tenantContext } from '../src/middleware/tenantContext';

async function test() {
  const targetDb = 'kms_apple_1235'; 
  console.log('Testing settings lookup for database:', targetDb);
  
  try {
    const settingsObj: any = {};
    let tenantPlan = 'Basic';
    let companyName = '';
    
    // 1. Outer run
    await tenantContext.run({ dbName: targetDb }, async () => {
      // 2. Inner run
      await tenantContext.run({ dbName: 'kms_master' }, async () => {
        const [tenantRows]: any = await pool.execute('SELECT plan, name FROM tenants WHERE db_name = ?', [targetDb]);
        console.log('Master DB lookup result:', tenantRows);
        if (tenantRows && tenantRows.length > 0) {
          tenantPlan = tenantRows[0].plan;
          companyName = tenantRows[0].name;
        }
      });
      
      console.log('Company Name resolved:', companyName, 'Plan:', tenantPlan);
      
      if (companyName) {
        settingsObj.company_name = companyName;
        console.log('Attempting to save company_name in tenant db...');
        await pool.execute(
          'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          ['company_name', companyName, companyName]
        );
        console.log('Successfully saved company_name.');
      }
    });
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    process.exit(0);
  }
}

test();
