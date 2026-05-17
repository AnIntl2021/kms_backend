import dotenv from 'dotenv';
import path from 'path';

// ES-Module-safe environment loading using process.cwd()
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import pool from '../src/config/db';

async function main() {
  const commit = process.argv.includes('--commit');
  
  try {
    console.log('🔍 Scanning database for cost discrepancies between items and active batches...\n');
    
    // Fetch all active items and join with active batches
    const [mismatches]: any = await pool.execute(`
      SELECT 
        ii.inventory_item_id,
        ii.name_en,
        ii.sku,
        ii.unit_en,
        ii.cost_price AS target_cost,
        ib.batch_id,
        ib.cost_per_unit AS current_batch_cost,
        ib.remaining_quantity,
        ib.created_at
      FROM inventory_items ii
      JOIN inventory_batches ib ON ii.inventory_item_id = ib.inventory_item_id
      WHERE ii.deleted_at IS NULL 
        AND ib.status = 'active'
        AND ABS(ii.cost_price - ib.cost_per_unit) > 0.001
      ORDER BY ii.name_en ASC, ib.created_at ASC
    `);

    if (mismatches.length === 0) {
      console.log('✅ Congratulations! No cost discrepancies found. All active batches are perfectly synchronized with your stock item prices!');
      process.exit(0);
    }

    console.log(`⚠️  Found ${mismatches.length} active batch(es) with cost discrepancies:`);
    console.log('================================================================================');

    let currentItemName = '';
    mismatches.forEach((m: any) => {
      if (currentItemName !== m.name_en) {
        console.log(`\n📦 Item: ${m.name_en} (${m.sku})`);
        console.log(`   - Base Unit: ${m.unit_en}`);
        console.log(`   - Target Cost in Settings: ${Number(m.target_cost).toFixed(3)} KD`);
        currentItemName = m.name_en;
      }
      console.log(`     ↳ [Batch ID: ${m.batch_id}] Created: ${new Date(m.created_at).toLocaleDateString()}`);
      console.log(`       • Remaining Qty: ${Number(m.remaining_quantity).toFixed(3)} ${m.unit_en}`);
      console.log(`       • Current Batch Cost: ${Number(m.current_batch_cost).toFixed(3)} KD  ❌ (Mismatch)`);
      console.log(`       • Will be updated to: ${Number(m.target_cost).toFixed(3)} KD  ➡️  (Correct)`);
    });

    console.log('\n================================================================================');

    if (!commit) {
      console.log('\n🛡️  DRY RUN: No changes were made to the live database.');
      console.log('👉 To automatically fix all these items at once, run the following command:');
      console.log('   npx tsx scratch/sync_all_batch_costs.ts --commit');
    } else {
      console.log('\n🚀 COMMIT MODE: Aligning active batch costs to matches stock item settings...');
      
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        
        for (const m of mismatches) {
          await connection.execute(
            'UPDATE inventory_batches SET cost_per_unit = ? WHERE batch_id = ?',
            [m.target_cost, m.batch_id]
          );
          console.log(`✅ Synchronized Batch ID ${m.batch_id} to ${Number(m.target_cost).toFixed(3)} KD`);
        }
        
        await connection.commit();
        console.log('\n🎉 SUCCESS: The entire inventory has been successfully synchronized and fixed! All active batches now perfectly reflect your standard item pricing.');
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Script encountered an error:', error);
    process.exit(1);
  }
}

main();
