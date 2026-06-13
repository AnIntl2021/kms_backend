import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';
export const getProductionLogs = async (req, res) => {
    try {
        const [logs] = await pool.execute(`
      SELECT 
        pl.production_id, pl.batch_number, 
        DATE_FORMAT(pl.production_date, '%Y-%m-%d') as production_date, 
        DATE_FORMAT(pl.expiry_date, '%Y-%m-%d') as expiry_date, 
        pl.branch_id,
        COUNT(pi.menu_item_id) as total_items,
        SUM(pi.quantity_produced) as total_qty,
        GROUP_CONCAT(CONCAT(mi.name_en, ' (', pi.quantity_produced, ')') SEPARATOR ', ') as product_summary
      FROM production_logs pl
      LEFT JOIN production_items pi ON pl.production_id = pi.production_id
      LEFT JOIN menu_items mi ON pi.menu_item_id = mi.menu_item_id
      WHERE pl.deleted_at IS NULL
      GROUP BY pl.production_id
      ORDER BY pl.production_date DESC, pl.production_id DESC
    `);
        return successResponse(res, logs);
    }
    catch (error) {
        return errorResponse(res, 'Failed to fetch production logs', 500, error);
    }
};
export const recordBatchProduction = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { production_date, expiry_date, items, branch_id, vendor_id } = req.body;
        const batch_number = `B-PROD-${Date.now()}`;
        // Fix parameter order: batch_number, production_date, expiry_date, branch_id
        const sanitizedProdDate = production_date ? String(production_date).split('T')[0] : new Date().toISOString().split('T')[0];
        const sanitizedExpDate = expiry_date ? String(expiry_date).split('T')[0] : null;
        const [result] = await connection.execute('INSERT INTO production_logs (batch_number, production_date, expiry_date, branch_id) VALUES (?, ?, ?, ?)', [batch_number, sanitizedProdDate, sanitizedExpDate, branch_id && String(branch_id).trim().toLowerCase() === 'main' ? null : (branch_id || null)]);
        const production_id = result.insertId;
        if (items && Array.isArray(items)) {
            for (const item of items) {
                await connection.execute('INSERT INTO production_items (production_id, menu_item_id, quantity_produced) VALUES (?, ?, ?)', [production_id, item.menu_item_id, item.quantity]);
                await connection.execute('UPDATE menu_items SET current_stock = current_stock + ? WHERE menu_item_id = ?', [item.quantity, item.menu_item_id]);
                const [ingredients] = await connection.execute(`SELECT 
            mii.inventory_item_id, 
            mii.quantity, 
            IFNULL(iip.multiplier, 1) as multiplier 
           FROM menu_item_ingredients mii
           LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
           WHERE mii.menu_item_id = ?`, [item.menu_item_id]);
                for (const ing of ingredients) {
                    // If 1 Packet = 10 Pieces, then 1 Piece = (1/10) Packets.
                    // Formula: totalDeduction = (Quantity * Multiplier) * BatchQty
                    const totalDeduction = (Number(ing.quantity) * Number(ing.multiplier)) * Number(item.quantity);
                    // Check if stock is sufficient to provide a better error message
                    const [invRows] = await connection.execute('SELECT current_stock, name_en FROM inventory_items WHERE inventory_item_id = ?', [ing.inventory_item_id]);
                    if (invRows.length > 0 && Number(invRows[0].current_stock) < totalDeduction) {
                        throw new Error(`Insufficient stock for ingredient: ${invRows[0].name_en}. Available: ${invRows[0].current_stock}, Required: ${totalDeduction}`);
                    }
                    await connection.execute('UPDATE inventory_items SET current_stock = current_stock - ? WHERE inventory_item_id = ?', [totalDeduction, ing.inventory_item_id]);
                }
            }
        }
        await connection.commit();
        return successResponse(res, { production_id, batch_number }, 'Batch production recorded successfully!');
    }
    catch (error) {
        await connection.rollback();
        return errorResponse(res, error.message || 'Production failed');
    }
    finally {
        connection.release();
    }
};
export const deleteProductionBatch = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        // 1. Get batch items and production info
        const [items] = await connection.execute('SELECT menu_item_id, quantity_produced FROM production_items WHERE production_id = ?', [id]);
        // 2. Revert Stock
        for (const item of items) {
            // 2a. Deduct produced products from menu_items
            const [menuItem] = await connection.execute('SELECT current_stock, name_en FROM menu_items WHERE menu_item_id = ?', [item.menu_item_id]);
            if (menuItem.length > 0 && Number(menuItem[0].current_stock) < Number(item.quantity_produced)) {
                // Warning: Stock is already lower than what we are trying to revert. 
                // We can either throw error or just cap at 0, but here we'll throw to be safe
                // OR we can just let it go if the DB is altered to allow negative.
            }
            await connection.execute('UPDATE menu_items SET current_stock = current_stock - ? WHERE menu_item_id = ?', [item.quantity_produced, item.menu_item_id]);
            // 2b. Find ingredients and restore them to inventory
            const [ingredients] = await connection.execute(`SELECT 
          mii.inventory_item_id, 
          mii.quantity as ingredient_qty, 
          IFNULL(iip.multiplier, 1) as multiplier 
         FROM menu_item_ingredients mii
         LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
         WHERE mii.menu_item_id = ?`, [item.menu_item_id]);
            for (const ing of ingredients) {
                const totalRestoration = (Number(ing.ingredient_qty) * Number(ing.multiplier)) * Number(item.quantity_produced);
                // Restore to global stock
                await connection.execute('UPDATE inventory_items SET current_stock = current_stock + ? WHERE inventory_item_id = ?', [totalRestoration, ing.inventory_item_id]);
                // Restore to oldest active batch (FIFO logic)
                const [targetBatch] = await connection.execute('SELECT batch_id FROM inventory_batches WHERE inventory_item_id = ? AND status = "active" ORDER BY created_at ASC LIMIT 1', [ing.inventory_item_id]);
                if (targetBatch.length > 0) {
                    await connection.execute('UPDATE inventory_batches SET remaining_quantity = remaining_quantity + ?, status = "active" WHERE batch_id = ?', [totalRestoration, targetBatch[0].batch_id]);
                }
            }
        }
        // 3. Mark as deleted
        await connection.execute('UPDATE production_logs SET deleted_at = CURRENT_TIMESTAMP WHERE production_id = ?', [id]);
        await connection.commit();
        return successResponse(res, null, 'Production batch deleted and stock reverted successfully');
    }
    catch (error) {
        if (connection)
            await connection.rollback();
        return errorResponse(res, 'Failed to delete and revert production batch: ' + error.message, 500, error);
    }
    finally {
        if (connection)
            connection.release();
    }
};
