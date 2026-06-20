import { Request, Response } from 'express';
import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getSales = async (req: Request, res: Response) => {
  try {
    // 🤖 AUTO-SETTLEMENT ORACLE: Temporarily disabled to allow manual overrides during testing.
    /*
    await pool.execute(`
      UPDATE sales_orders 
      SET payment_status = 'paid' 
      WHERE payment_status = 'credit' 
      AND expiry_date <= CURRENT_DATE()
      AND deleted_at IS NULL
    `);
    */

    const user = (req as any).user;
    let query = `
      SELECT s.*, 
      (SELECT COUNT(*) FROM sales_order_items WHERE sale_id = s.sale_id) as items_count,
      IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0) as returns_amount,
      DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
      b.name_en as branch_name,
      b.phone as branch_phone,
      s.client_phone as client_phone,
      a.first_name as salesman_name,
      s.payment_method
      FROM sales_orders s 
      LEFT JOIN branches b ON s.branch_id = b.branch_id
      LEFT JOIN admins a ON s.admin_id = a.admin_id
      WHERE s.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (user && user.brand_id) {
      query += ' AND s.brand_id = ?';
      params.push(user.brand_id);
    } else if (req.query.brand_id) {
      query += ' AND s.brand_id = ?';
      params.push(req.query.brand_id);
    }

    if (user && user.branch_id) {
      query += ' AND s.branch_id = ?';
      params.push(user.branch_id);
    }

    query += ' ORDER BY s.created_at DESC, s.sale_id DESC';
    const [rows]: any = await pool.execute(query, params);

    if (rows.length > 0) {
      const saleIds = rows.map((r: any) => r.sale_id);
      const [items]: any = await pool.execute(`
        SELECT soi.sale_id, soi.menu_item_id, mi.name_en, soi.quantity,
          (
             SELECT COALESCE(SUM(sri.quantity), 0) 
             FROM sales_return_items sri 
             JOIN sales_returns sr ON sri.return_id = sr.return_id 
             WHERE sri.menu_item_id = soi.menu_item_id AND sr.sale_id = soi.sale_id
          ) as returns_qty
        FROM sales_order_items soi
        JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
        WHERE soi.sale_id IN (${saleIds.join(',')})
      `);

      rows.forEach((row: any) => {
        row.items_json = JSON.stringify(items.filter((i: any) => i.sale_id === row.sale_id));
      });
    }

    return successResponse(res, rows);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch sales', 500, error);
  }
};

export const getSaleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [orders]: any = await pool.execute(`
      SELECT s.*, 
             DATE_FORMAT(s.created_at, '%Y-%m-%d') as order_date,
             DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
             b.name_en as branch_name,
             b.phone as branch_phone,
             s.client_phone as client_phone,
             a.first_name as salesman_name,
             s.payment_method
      FROM sales_orders s 
      LEFT JOIN branches b ON s.branch_id = b.branch_id
      LEFT JOIN admins a ON s.admin_id = a.admin_id
      WHERE s.sale_id = ?
    `, [id]);

    if (orders.length === 0) return errorResponse(res, 'Order not found', 404);

    const [items]: any = await pool.execute(`
      SELECT soi.*, mi.name_en, mi.name_ar
      FROM sales_order_items soi
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      WHERE soi.sale_id = ?
    `, [id]);

    const orderData = { ...orders[0], items };
    return successResponse(res, orderData);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch order details', 500, error);
  }
};

export const createSale = async (req: any, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { branch_id, customer_name, client_phone, client_address, notes, items, total_amount, order_type, payment_method, payment_status, counter_id } = req.body;
    const admin_id = req.user?.admin_id || 1;
    let brandId = req.user?.brand_id || null;

    await connection.beginTransaction();

    if (!brandId && branch_id) {
      const [branchRows]: any = await connection.execute(
        'SELECT brand_id FROM branches WHERE branch_id = ?',
        [branch_id]
      );
      if (branchRows && branchRows.length > 0) {
        brandId = branchRows[0].brand_id;
      }
    }

    const [orderRes]: any = await connection.execute(
      'INSERT INTO sales_orders (order_number, branch_id, order_type, payment_method, payment_status, customer_name, client_phone, client_address, notes, total_amount, status, admin_id, brand_id, counter_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['PENDING', branch_id || 1, order_type || 'walk_in', payment_method || 'cash', payment_status || (payment_method === 'credit' ? 'credit' : 'paid'), customer_name || null, client_phone || null, client_address || null, notes || null, total_amount, 'completed', admin_id, brandId, counter_id || null]
    );

    const sale_id = orderRes.insertId;
    
    // Fetch order number prefix dynamically from settings
    const [settingsRows]: any = await connection.execute(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'order_prefix'"
    );
    const prefix = (settingsRows && settingsRows.length > 0) ? settingsRows[0].setting_value : 'ORD-';
    const order_number = `${prefix}${100000 + sale_id}`;

    // Update the record with the professional order number
    await connection.execute(
      'UPDATE sales_orders SET order_number = ? WHERE sale_id = ?',
      [order_number, sale_id]
    );

    for (const item of items) {
      await connection.execute(
        'INSERT INTO sales_order_items (sale_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)',
        [sale_id, item.menu_item_id, item.quantity, item.price]
      );

      // --- STOCK DEDUCTION (BOM - BILL OF MATERIALS with MULTIPLIERS) ---
      const [ingredients]: any = await connection.execute(`
        SELECT mii.inventory_item_id, mii.quantity, mii.package_id, ip.multiplier
        FROM menu_item_ingredients mii
        LEFT JOIN inventory_item_packages ip ON mii.package_id = ip.package_id
        WHERE mii.menu_item_id = ?
      `, [item.menu_item_id]);

      for (const ingredient of ingredients) {
        let multiplier = 1;
        if (ingredient.package_id === 'virtual_gram' || ingredient.package_id === 'virtual_ml') {
          multiplier = 0.001;
        } else if (ingredient.multiplier) {
          multiplier = Number(ingredient.multiplier);
        }

        const totalDeduction = Number(ingredient.quantity) * Number(item.quantity) * multiplier;

        // 🛡️ THE MAYONNAISE FIFO CONSUMER ORACLE
        let remainingToDeduct = totalDeduction;

        // Fetch all active batches for this ingredient (Oldest First)
        const [batches]: any = await connection.execute(
          'SELECT batch_id, remaining_quantity FROM inventory_batches WHERE inventory_item_id = ? AND status = "active" ORDER BY created_at ASC FOR UPDATE',
          [ingredient.inventory_item_id]
        );

        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;

          const batchQty = Number(batch.remaining_quantity);
          const deductFromThisBatch = Math.min(batchQty, remainingToDeduct);
          const newBatchQty = batchQty - deductFromThisBatch;
          remainingToDeduct -= deductFromThisBatch;

          // Update the batch remains
          await connection.execute(
            'UPDATE inventory_batches SET remaining_quantity = ?, status = ? WHERE batch_id = ?',
            [newBatchQty, newBatchQty <= 0 ? 'exhausted' : 'active', batch.batch_id]
          );

          console.log(`📡 FIFO CONSUMED: BatchID=${batch.batch_id}, Deducted=${deductFromThisBatch}, Remains=${newBatchQty}`);
        }

        // Finalize global stock count (For metrics)
        await connection.execute(
          'UPDATE inventory_items SET current_stock = current_stock - ? WHERE inventory_item_id = ?',
          [totalDeduction, ingredient.inventory_item_id]
        );

        // Log movement
        await connection.execute(
          'INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
          [admin_id, 'Stock Deduction (Sale)', 'InventoryItem', ingredient.inventory_item_id, JSON.stringify({ sale_id, deducted_qty: totalDeduction })]
        );
      }
    }

    await connection.commit();
    console.log('✅ Sale created successfully:', sale_id);
    return successResponse(res, { sale_id, order_number }, 'Sale recorded successfully');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ CREATE SALE ERROR:', error);
    return errorResponse(res, 'Failed to create sale: ' + (error instanceof Error ? error.message : String(error)), 500, error);
  } finally {
    if (connection) connection.release();
  }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;
    await pool.execute('UPDATE sales_orders SET payment_status = ? WHERE sale_id = ?', [payment_status, id]);
    return successResponse(res, null, 'Payment status updated');
  } catch (error) {
    return errorResponse(res, 'Update failed', 500, error);
  }
};

export const updateSaleStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dispatch_status } = req.body;

    // 📢 NOTIFICATION TRIGGER
    const [order]: any = await pool.execute('SELECT order_number, customer_name FROM sales_orders WHERE sale_id = ?', [id]);

    // 🛡️ ACTUAL DATABASE UPDATE (THE MISSING LINK)
    await pool.execute(
      'UPDATE sales_orders SET dispatch_status = ? WHERE sale_id = ?',
      [dispatch_status, id]
    );

    if (order.length > 0) {
      const msg = `⚡ Order ${order[0].order_number} (${order[0].customer_name}) status updated to: ${dispatch_status.toUpperCase()}`;
      const type = dispatch_status === 'delivered' ? 'success' : (dispatch_status === 'dispatched' ? 'info' : 'warning');

      await pool.execute(
        'INSERT INTO notifications (message, type) VALUES (?, ?)',
        [msg, type]
      );
    }

    return successResponse(res, null, 'Status updated successfully');
  } catch (error) {
    return errorResponse(res, 'Update failed', 500, error);
  }
};

export const deleteSale = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const admin_id = (req as any).user?.admin_id || 1;

    // 1. Get the items in this sale
    const [items]: any = await connection.execute(
      'SELECT menu_item_id, quantity FROM sales_order_items WHERE sale_id = ?',
      [id]
    );

    // 2. Loop through items and restore stock (Reverse BOM logic)
    for (const item of items) {
      const [ingredients]: any = await connection.execute(`
        SELECT mii.inventory_item_id, mii.quantity, mii.package_id, ip.multiplier
        FROM menu_item_ingredients mii
        LEFT JOIN inventory_item_packages ip ON mii.package_id = ip.package_id
        WHERE mii.menu_item_id = ?
      `, [item.menu_item_id]);

      for (const ingredient of ingredients) {
        let multiplier = 1;
        if (ingredient.package_id === 'virtual_gram' || ingredient.package_id === 'virtual_ml') {
          multiplier = 0.001;
        } else if (ingredient.multiplier) {
          multiplier = Number(ingredient.multiplier);
        }

        const totalRestoration = Number(ingredient.quantity) * Number(item.quantity) * multiplier;

        // Restore to global count
        await connection.execute(
          'UPDATE inventory_items SET current_stock = current_stock + ? WHERE inventory_item_id = ?',
          [totalRestoration, ingredient.inventory_item_id]
        );

        // Restore to oldest active batch (FIFO logic)
        const [targetBatch]: any = await connection.execute(
          'SELECT batch_id FROM inventory_batches WHERE inventory_item_id = ? AND status = "active" ORDER BY created_at ASC LIMIT 1',
          [ingredient.inventory_item_id]
        );

        if (targetBatch.length > 0) {
          await connection.execute(
            'UPDATE inventory_batches SET remaining_quantity = remaining_quantity + ?, status = "active" WHERE batch_id = ?',
            [totalRestoration, targetBatch[0].batch_id]
          );
        }

        // Log restoration
        await connection.execute(
          'INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
          [admin_id, 'Stock Restoration (Delete Order)', 'InventoryItem', ingredient.inventory_item_id, JSON.stringify({ sale_id: id, restored_qty: totalRestoration })]
        );
      }
    }

    // 3. Mark as deleted
    await connection.execute('UPDATE sales_orders SET deleted_at = CURRENT_TIMESTAMP WHERE sale_id = ?', [id]);

    await connection.commit();
    return successResponse(res, null, 'Order deleted and stock reverted successfully');
  } catch (error: any) {
    if (connection) await connection.rollback();
    return errorResponse(res, 'Failed to delete order and revert stock: ' + error.message, 500, error);
  } finally {
    if (connection) connection.release();
  }
};

export const returnOrder = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const saleId = parseInt(id as string);
    const admin_id = (req as any).user?.admin_id || 1;

    console.log('🔄 STARTING ORDER RETURN:', { saleId });
    await connection.beginTransaction();

    // 1. Get the items in this sale
    const [items]: any = await connection.execute(
      'SELECT menu_item_id, quantity FROM sales_order_items WHERE sale_id = ?',
      [saleId]
    );

    console.log('📦 ITEMS FOUND FOR RETURN:', items.length);

    // 2. Loop through items and restore stock (Reverse BOM with MULTIPLIERS)
    for (const item of items) {
      const [ingredients]: any = await connection.execute(`
        SELECT mii.inventory_item_id, mii.quantity, mii.package_id, ip.multiplier
        FROM menu_item_ingredients mii
        LEFT JOIN inventory_item_packages ip ON mii.package_id = ip.package_id
        WHERE mii.menu_item_id = ?
      `, [item.menu_item_id]);

      for (const ingredient of ingredients) {
        let multiplier = 1;
        if (ingredient.package_id === 'virtual_gram' || ingredient.package_id === 'virtual_ml') {
          multiplier = 0.001;
        } else if (ingredient.multiplier) {
          multiplier = Number(ingredient.multiplier);
        }

        const totalRestoration = Number(ingredient.quantity) * Number(item.quantity) * multiplier;
        console.log(`🔋 RESTORING INGREDIENT FIFO: id=${ingredient.inventory_item_id}, qty=${totalRestoration}`);

        // 🛡️ RE-INTEGRATE INTO OLDEST ACTIVE BATCH
        // (Maintaining the FIFO priority for the next sale)
        const [targetBatch]: any = await connection.execute(
          'SELECT batch_id FROM inventory_batches WHERE inventory_item_id = ? AND status = "active" ORDER BY created_at ASC LIMIT 1',
          [ingredient.inventory_item_id]
        );

        if (targetBatch.length > 0) {
          await connection.execute(
            'UPDATE inventory_batches SET remaining_quantity = remaining_quantity + ?, status = "active" WHERE batch_id = ?',
            [totalRestoration, targetBatch[0].batch_id]
          );
        }

        await connection.execute(
          'UPDATE inventory_items SET current_stock = current_stock + ? WHERE inventory_item_id = ?',
          [totalRestoration, ingredient.inventory_item_id]
        );

        // Log restoration
        await connection.execute(
          'INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, new_values) VALUES (?, ?, ?, ?, ?)',
          [admin_id, 'Stock Restoration (Return)', 'InventoryItem', ingredient.inventory_item_id, JSON.stringify({ sale_id: saleId, restored_qty: totalRestoration })]
        );
      }
    }

    // 3. Update sale status (Using 'cancelled' which is definitely supported)
    await connection.execute(
      'UPDATE sales_orders SET dispatch_status = ?, payment_status = ? WHERE sale_id = ?',
      ['cancelled', 'failed', saleId]
    );

    await connection.commit();
    console.log('✅ RETURN SUCCESSFUL:', saleId);
    return successResponse(res, null, 'Order returned and stock restored successfully');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ RETURN ERROR:', error);
    return errorResponse(res, 'Failed to process return', 500, error);
  } finally {
    if (connection) connection.release();
  }
};
