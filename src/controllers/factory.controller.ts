import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const produceSandwiches = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { menu_item_id, quantity } = req.body;
    const admin_id = (req as any).user.admin_id;

    const [ingredients]: any = await connection.execute(
      'SELECT inventory_item_id, quantity FROM menu_item_ingredients WHERE menu_item_id = ?',
      [menu_item_id]
    );

    for (const ing of ingredients) {
      const required = Number(ing.quantity) * Number(quantity);
      const [stock]: any = await connection.execute(
        'SELECT current_stock, name_en FROM inventory_items WHERE inventory_item_id = ? FOR UPDATE',
        [ing.inventory_item_id]
      );
      if (stock[0].current_stock < required) {
        throw new Error(`Insufficient ${stock[0].name_en}. Need ${required}, have ${stock[0].current_stock}`);
      }
      await connection.execute(
        'UPDATE inventory_items SET current_stock = current_stock - ? WHERE inventory_item_id = ?',
        [required, ing.inventory_item_id]
      );
    }

    await connection.execute(
      'UPDATE menu_items SET current_stock = current_stock + ? WHERE menu_item_id = ?',
      [quantity, menu_item_id]
    );

    await connection.execute(
      'INSERT INTO production_logs (menu_item_id, quantity_produced, admin_id) VALUES (?, ?, ?)',
      [menu_item_id, quantity, admin_id]
    );

    await connection.commit();
    return successResponse(res, null, 'Production completed and stock updated.');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Production failed');
  } finally {
    connection.release();
  }
};

export const createSalesOrder = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { vendor_id, branch_id, customer_name, items, payment_method, order_number, batch_number, expiry_date, discount_percentage, dispatch_date } = req.body;
    const admin_id = (req as any).user.admin_id;

    const totalAmount = items.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.price)), 0);
    const discountPercentage = discount_percentage !== undefined ? Number(discount_percentage) : (vendor_id ? 25.00 : 0.00); // Use provided discount or fallback to 25% for partners
    const discountAmount = (totalAmount * discountPercentage) / 100;
    const finalAmount = totalAmount - discountAmount;

    let resolvedCustomerName = customer_name;
    if (vendor_id && !resolvedCustomerName) {
      const [vendor]: any = await connection.execute('SELECT name_en FROM vendors WHERE vendor_id = ?', [vendor_id]);
      if (vendor.length > 0) resolvedCustomerName = vendor[0].name_en;
    }

    const [orderRes]: any = await connection.execute(
      `INSERT INTO sales_orders (order_number, vendor_id, branch_id, customer_name, total_amount, discount_percentage, discount_amount, final_amount, payment_method, admin_id, batch_number, expiry_date, dispatch_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_number || `SO-${Date.now()}`, vendor_id || null, branch_id === 'main' ? null : (branch_id || null), resolvedCustomerName || 'Counter Customer', totalAmount, discountPercentage, discountAmount, finalAmount, payment_method || 'cash', admin_id, batch_number || null, expiry_date || null, 'pending', dispatch_date || new Date()]
    );
    const sale_id = orderRes.insertId;

    for (const item of items) {
      const [menuItem]: any = await connection.execute('SELECT current_stock, name_en FROM menu_items WHERE menu_item_id = ? FOR UPDATE', [item.menu_item_id]);
      if (menuItem[0].current_stock < item.quantity) {
        throw new Error(`Insufficient stock for ${menuItem[0].name_en}`);
      }

      await connection.execute(
        `INSERT INTO sales_order_items (sale_id, menu_item_id, quantity, price, expiry_date, batch_number) VALUES (?, ?, ?, ?, ?, ?)`,
        [sale_id, item.menu_item_id, item.quantity, item.price, expiry_date || null, batch_number || null]
      );

      await connection.execute('UPDATE menu_items SET current_stock = current_stock - ? WHERE menu_item_id = ?', [item.quantity, item.menu_item_id]);
    }

    await connection.commit();
    return successResponse(res, { sale_id }, 'Sale & Branch Dispatch completed.');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Sales transaction failed');
  } finally {
    connection.release();
  }
};

export const getDispatches = async (req: Request, res: Response) => {
  try {
    const [dispatches]: any = await pool.execute(`
      SELECT 
        s.sale_id, s.order_number, s.vendor_id, s.branch_id, s.customer_name, s.total_amount, 
        s.discount_amount, s.final_amount, s.dispatch_status, s.batch_number, s.expiry_date, 
        DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
        s.created_at,
        v.name_en as client_name,
        pb.name_en as branch_name
      FROM sales_orders s
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      WHERE s.vendor_id IS NOT NULL
      ORDER BY s.created_at DESC
    `);
    return successResponse(res, dispatches);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch dispatches', 500, error);
  }
};

export const processReturn = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { sale_id, vendor_id, branch_id, items, reason } = req.body;
    const admin_id = (req as any).user.admin_id;

    let total_credit = 0;
    items.forEach((i: any) => total_credit += (Number(i.quantity) * Number(i.unit_price)));

    const [returnRes]: any = await connection.execute(
      'INSERT INTO sales_returns (sale_id, vendor_id, branch_id, reason, total_credit_amount, admin_id) VALUES (?, ?, ?, ?, ?, ?)',
      [sale_id || null, vendor_id, branch_id === 'main' ? null : (branch_id || null), reason || 'Expired', total_credit, admin_id]
    );
    const return_id = returnRes.insertId;

    for (const item of items) {
      await connection.execute(
        'INSERT INTO sales_return_items (return_id, menu_item_id, quantity, unit_price, expiry_date) VALUES (?, ?, ?, ?, ?)',
        [return_id, item.menu_item_id || item.product_id, item.quantity, item.price || item.unit_price, item.expiry_date]
      );

      await connection.execute(
        'INSERT INTO wastage (menu_item_id, return_id, quantity, reason_en, admin_id) VALUES (?, ?, ?, ?, ?)',
        [item.menu_item_id || item.product_id, return_id, item.quantity, `Returned from Vendor: ${reason || 'Expired'}`, admin_id]
      );
    }

    await connection.commit();
    return successResponse(res, { return_id }, 'Return processed and items wasted.');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Failed to process return');
  } finally {
    connection.release();
  }
};

export const updateSalesOrder = async (req: Request, res: Response) => {
  const { sale_id } = req.params;
  const { vendor_id, branch_id, customer_name, items, batch_number, expiry_date, discount_percentage, dispatch_status } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Check if order exists and is not locked
    const [existing]: any = await connection.execute('SELECT dispatch_status FROM sales_orders WHERE sale_id = ? FOR UPDATE', [sale_id]);
    if (existing.length === 0) throw new Error('Order not found');
    if (existing[0].dispatch_status === 'delivered') throw new Error('Order is already delivered and locked.');

    // 2. Restore Old Stock
    const [oldItems]: any = await connection.execute('SELECT menu_item_id, quantity FROM sales_order_items WHERE sale_id = ?', [sale_id]);
    for (const item of oldItems) {
      await connection.execute('UPDATE menu_items SET current_stock = current_stock + ? WHERE menu_item_id = ?', [item.quantity, item.menu_item_id]);
    }

    // 3. Wipe Old Items
    await connection.execute('DELETE FROM sales_order_items WHERE sale_id = ?', [sale_id]);

    // 4. Record New Data & Recalculate Totals
    const totalAmount = items.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.price)), 0);
    const discP = Number(discount_percentage || 0);
    const discountAmount = (totalAmount * discP) / 100;
    const finalAmount = totalAmount - discountAmount;

    await connection.execute(
      `UPDATE sales_orders SET 
        vendor_id = ?, 
        branch_id = ?, 
        customer_name = ?, 
        total_amount = ?, 
        discount_percentage = ?, 
        discount_amount = ?, 
        final_amount = ?, 
        batch_number = ?, 
        expiry_date = ?,
        dispatch_status = ?
      WHERE sale_id = ?`,
      [
        vendor_id || null, 
        branch_id === 'main' ? null : (branch_id || null), 
        customer_name || 'Counter Customer', 
        totalAmount, 
        discP, 
        discountAmount, 
        finalAmount, 
        batch_number || null, 
        expiry_date || null, 
        dispatch_status || existing[0].dispatch_status || 'pending',
        sale_id
      ]
    );

    // 5. Deduct New Stock & Insert Items
    for (const item of items) {
      const [menuItem]: any = await connection.execute('SELECT current_stock, name_en FROM menu_items WHERE menu_item_id = ? FOR UPDATE', [item.menu_item_id]);
      if (menuItem[0].current_stock < item.quantity) {
        throw new Error(`Insufficient stock for ${menuItem[0].name_en} during update.`);
      }

      await connection.execute(
        `INSERT INTO sales_order_items (sale_id, menu_item_id, quantity, price, expiry_date, batch_number) VALUES (?, ?, ?, ?, ?, ?)`,
        [sale_id, item.menu_item_id, item.quantity, item.price, expiry_date || null, batch_number || null]
      );

      await connection.execute('UPDATE menu_items SET current_stock = current_stock - ? WHERE menu_item_id = ?', [item.quantity, item.menu_item_id]);
    }

    await connection.commit();
    return successResponse(res, null, 'Order fully updated and stock reconciled.');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Failed to update order', 500, error);
  } finally {
    connection.release();
  }
};

export const getReturns = async (req: Request, res: Response) => {
  try {
    const [returns]: any = await pool.execute(`
      SELECT 
        r.return_id, r.sale_id, r.total_credit_amount, r.reason, r.created_at,
        v.name_en as client_name,
        pb.name_en as branch_name
      FROM sales_returns r
      LEFT JOIN vendors v ON r.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON r.branch_id = pb.branch_id
      ORDER BY r.created_at DESC
    `);
    return successResponse(res, returns);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch returns history', 500, error);
  }
};

export const getOrderItems = async (req: Request, res: Response) => {
  const { sale_id } = req.params;
  try {
    const [items]: any = await pool.execute(`
      SELECT 
        si.menu_item_id, si.quantity, si.price,
        m.name_en, m.name_ar
      FROM sales_order_items si
      JOIN menu_items m ON si.menu_item_id = m.menu_item_id
      WHERE si.sale_id = ?
    `, [sale_id]);
    return successResponse(res, items);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch order items', 500, error);
  }
};
