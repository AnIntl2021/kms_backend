import mysql from 'mysql2/promise';

async function checkReturnsSchema() {
  try {
    const connection = await mysql.createConnection({
      host: '64.227.182.87',
      user: 'fnf_user',
      password: 'FreshFast_Admin_2026!',
      database: 'fresh_n_fast_prod'
    });
    
    console.log('CONNECTED TO LIVE DB SUCCESS!');
    
    // Get returns
    const [returns]: any = await connection.execute("SELECT * FROM sales_returns ORDER BY created_at DESC LIMIT 5");
    console.log('Returns found:', returns);
    
    for (const ret of returns) {
      console.log(`\nItems for Return ID ${ret.return_id}:`);
      const [items]: any = await connection.execute("SELECT * FROM sales_return_items WHERE return_id = ?", [ret.return_id]);
      console.log(items);
      
      for (const item of items) {
        const [menu]: any = await connection.execute("SELECT name_en, price, cost_price FROM menu_items WHERE menu_item_id = ?", [item.menu_item_id]);
        console.log(`Associated menu item for menu_item_id ${item.menu_item_id}:`, menu);
      }
    }
    
    await connection.end();
  } catch (e: any) {
    console.error('Error occurred:', e.message);
  }
}

checkReturnsSchema();
