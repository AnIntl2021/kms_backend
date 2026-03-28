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
