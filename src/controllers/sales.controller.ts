import { Request, Response } from 'express';
import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getSales = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute(`
      SELECT s.*, 
      (SELECT COUNT(*) FROM sales_order_items WHERE sale_id = s.sale_id) as items_count,
      DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i') as order_date
      FROM sales_orders s 
      ORDER BY s.created_at DESC
    `);
    return successResponse(res, rows);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch sales', 500, error);
  }
};

export const getSaleById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [orders]: any = await pool.execute(`
      SELECT s.*, DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i') as order_date
      FROM sales_orders s 
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
    const { customer_name, items, total_amount, payment_status, dispatch_status } = req.body;
    const admin_id = req.user?.admin_id || 1;

    await connection.beginTransaction();

    const order_number = 'ORD-' + Date.now();

    const [orderRes]: any = await connection.execute(
      'INSERT INTO sales_orders (order_number, customer_name, total_amount, payment_status, dispatch_status, admin_id) VALUES (?, ?, ?, ?, ?, ?)',
      [order_number, customer_name, total_amount, payment_status || 'paid', dispatch_status || 'pending', admin_id]
    );

    const sale_id = orderRes.insertId;

    for (const item of items) {
      await connection.execute(
        'INSERT INTO sales_order_items (sale_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)',
        [sale_id, item.menu_item_id, item.quantity, item.price]
      );

      // --- STOCK DEDUCTION (BOM - BILL OF MATERIALS with MULTIPLIERS) ---
      const [ingredients]: any = await connection.execute(`
        SELECT mii.inventory_item_id, mii.quantity, mii.package_id, ip.multiplier
        FROM menu_item_ingredients mii
        LEFT JOIN inventory_packages ip ON mii.package_id = ip.package_id
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
    return successResponse(res, { sale_id }, 'Sale recorded successfully');
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ CREATE SALE ERROR:', error);
    return errorResponse(res, 'Failed to create sale: ' + (error instanceof Error ? error.message : String(error)), 500, error);
  } finally {
    if (connection) connection.release();
  }
};

export const updateSaleStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { dispatch_status } = req.body;

    await pool.execute(
      'UPDATE sales_orders SET dispatch_status = ? WHERE sale_id = ?',
      [dispatch_status, id]
    );

    return successResponse(res, null, 'Status updated');
  } catch (error) {
    return errorResponse(res, 'Update failed', 500, error);
  }
};

export const returnOrder = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const saleId = parseInt(id);
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
        LEFT JOIN inventory_packages ip ON mii.package_id = ip.package_id
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
        console.log(`🔋 RESTORING INGREDIENT: id=${ingredient.inventory_item_id}, qty=${totalRestoration}`);
        
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
