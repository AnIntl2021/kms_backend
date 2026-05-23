import mysql from 'mysql2/promise';

const dbConfig = {
  host: '64.227.182.87',
  user: 'fnf_user',
  password: 'FreshFast_Admin_2026!',
  database: 'fresh_n_fast_prod',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

async function checkStockValue() {
  try {
    let query = `
      SELECT i.inventory_item_id, i.name_en, i.sku, i.current_stock, i.cost_price,
      (SELECT cost_per_unit FROM inventory_batches WHERE inventory_item_id = i.inventory_item_id AND status = 'active' ORDER BY created_at ASC LIMIT 1) as dynamic_cost_price
      FROM inventory_items i 
      WHERE i.deleted_at IS NULL
    `;
    const [items]: any = await pool.execute(query);
    
    let totalStockValue = 0;
    const itemsWithValue = items.map((item: any) => {
      const qty = Number(item.current_stock) || 0;
      const price = Number(item.dynamic_cost_price || item.cost_price || 0);
      const value = qty * price;
      totalStockValue += value;
      return {
        id: item.inventory_item_id,
        name: item.name_en,
        sku: item.sku,
        stock: qty,
        cost: price,
        value: value
      };
    });

    // Sort by value descending
    itemsWithValue.sort((a: any, b: any) => b.value - a.value);

    console.log('--- INDIVIDUAL STOCK ITEMS VALUE (TOP 20) ---');
    itemsWithValue.slice(0, 20).forEach((item: any) => {
      console.log(`${item.sku} | ${item.name} | Stock: ${item.stock.toFixed(3)} | Cost/Unit: ${item.cost.toFixed(3)} KD | Total Value: ${item.value.toFixed(3)} KD`);
    });

    console.log('\n===========================================');
    console.log(`TOTAL INVENTORY ITEMS COUNT: ${itemsWithValue.length}`);
    console.log(`TOTAL CALCULATED STOCK VALUE: ${totalStockValue.toFixed(3)} KD`);
    console.log('===========================================');

    process.exit(0);
  } catch (error) {
    console.error('Error checking stock value:', error);
    process.exit(1);
  }
}

checkStockValue();
