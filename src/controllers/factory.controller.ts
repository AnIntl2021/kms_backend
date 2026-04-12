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
    const { vendor_id, branch_id, customer_name, items, payment_method, order_number, batch_number, expiry_date } = req.body;
    const admin_id = (req as any).user.admin_id;

    const numItems = items.reduce((acc: number, item: any) => acc + Number(item.quantity * item.price), 0);
    
    // 🛡️ BRANCH SEGREGATION ORACLE (Persist specific branch delivery node)
    const [orderRes]: any = await connection.execute(
      `INSERT INTO sales_orders (order_number, vendor_id, branch_id, customer_name, total_amount, payment_method, admin_id, batch_number, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_number || `SO-${Date.now()}`, vendor_id || null, branch_id === 'main' ? null : (branch_id || null), customer_name || 'Counter Customer', numItems, payment_method || 'cash', admin_id, batch_number || null, expiry_date || null]
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
        s.sale_id, s.order_number, s.total_amount, s.dispatch_status, s.created_at,
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
    const { sale_id, vendor_id, items, reason } = req.body;
    const admin_id = (req as any).user.admin_id;

    let total_credit = 0;
    items.forEach((i: any) => total_credit += (Number(i.quantity) * Number(i.unit_price)));

    const [returnRes]: any = await connection.execute(
      'INSERT INTO sales_returns (sale_id, vendor_id, reason, total_credit_amount, admin_id) VALUES (?, ?, ?, ?, ?)',
      [sale_id || null, vendor_id, reason || 'Expired', total_credit, admin_id]
    );
    const return_id = returnRes.insertId;

    for (const item of items) {
      await connection.execute(
        'INSERT INTO sales_return_items (return_id, menu_item_id, quantity, unit_price, expiry_date) VALUES (?, ?, ?, ?, ?)',
        [return_id, item.menu_item_id, item.quantity, item.unit_price, item.expiry_date]
      );

      await connection.execute(
        'INSERT INTO wastage (menu_item_id, return_id, quantity, reason_en, admin_id) VALUES (?, ?, ?, ?, ?)',
        [item.menu_item_id, return_id, item.quantity, `Returned from Vendor: ${reason || 'Expired'}`, admin_id]
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
