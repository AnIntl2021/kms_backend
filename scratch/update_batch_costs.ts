import dotenv from 'dotenv';
import path from 'path';

// ES-Module-safe environment loading using process.cwd()
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import pool from '../src/config/db';

async function main() {
  const commit = process.argv.includes('--commit');
  
  try {
    console.log('🔍 Locating "Arzco Olive Oil" in the database...');
    const [items]: any = await pool.execute(
      'SELECT inventory_item_id, name_en, cost_price, unit_en FROM inventory_items WHERE name_en LIKE "%Arzco%" AND deleted_at IS NULL'
    );

    if (items.length === 0) {
      console.log('❌ Error: Arzco Olive Oil not found in inventory items.');
      process.exit(1);
    }

    const item = items[0];
    console.log(`\n📦 Item Found: ${item.name_en}`);
    console.log(`- Item ID: ${item.inventory_item_id}`);
    console.log(`- Base Unit: ${item.unit_en}`);
    console.log(`- Current Settings Cost Price: ${item.cost_price} KD`);

    // Fetch active batches
    const [batches]: any = await pool.execute(
      'SELECT batch_id, purchase_id, original_quantity, remaining_quantity, cost_per_unit, created_at FROM inventory_batches WHERE inventory_item_id = ? AND status = "active"',
      [item.inventory_item_id]
    );

    console.log(`\n📊 Active Batches Found: ${batches.length}`);
    if (batches.length === 0) {
      console.log('ℹ️ No active batches found for this item.');
      process.exit(0);
    }

    // Display each batch's current cost
    batches.forEach((b: any, index: number) => {
      console.log(`  [Batch #${index + 1}] (ID: ${b.batch_id})`);
      console.log(`    - Date Created: ${b.created_at}`);
      console.log(`    - Remaining Qty: ${b.remaining_quantity} ${item.unit_en}`);
      console.log(`    - Current Batch Cost: ${b.cost_per_unit} KD per ${item.unit_en}`);
      console.log(`    - Resulting Liter Cost: ${(b.cost_per_unit / 12).toFixed(3)} KD / Liter`);
    });

    console.log('\n--------------------------------------------------');
    const targetBaseCost = 36.000; // 36 KD per Carton = 3 KD per Liter
    console.log(`🎯 TARGET BATCH COST: ${targetBaseCost.toFixed(3)} KD per ${item.unit_en} (3.000 KD / Liter)`);
    console.log('--------------------------------------------------');

    if (!commit) {
      console.log('\n🛡️ DRY RUN: No changes were made to the live database.');
      console.log('👉 To apply this update to your live database, run this command in your terminal:');
      console.log('   npx tsx scratch/update_batch_costs.ts --commit');
    } else {
      console.log('\n🚀 COMMIT MODE: Applying updates to active batches...');
      
      for (const b of batches) {
        await pool.execute(
          'UPDATE inventory_batches SET cost_per_unit = ? WHERE batch_id = ?',
          [targetBaseCost, b.batch_id]
        );
        console.log(`✅ Updated Batch ID ${b.batch_id} to ${targetBaseCost.toFixed(3)} KD`);
      }

      // Also ensure the item's default settings cost is aligned
      await pool.execute(
        'UPDATE inventory_items SET cost_price = ? WHERE inventory_item_id = ?',
        [targetBaseCost, item.inventory_item_id]
      );
      console.log(`✅ Updated Default Stock Item Settings Cost to ${targetBaseCost.toFixed(3)} KD`);

      console.log('\n🎉 Successfully updated all active batches! Your recipes will now reflect the correct 3.000 KD/Liter cost.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Script encountered an error:', error);
    process.exit(1);
  }
}

main();
