import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const getWastageLogs = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(`
      SELECT w.*, 
             p.name_en as product_name_en, p.name_ar as product_name_ar,
             ii.name_en as item_name_en, ii.name_ar as item_name_ar,
             mi.name_en as menu_name_en, mi.name_ar as menu_name_ar,
             a.username as admin_name,
             (w.quantity * COALESCE(mi.cost_price, ii.cost_price, 0)) as total_wasted_value
      FROM wastage w
      LEFT JOIN products p ON w.product_id = p.product_id
      LEFT JOIN inventory_items ii ON w.inventory_item_id = ii.inventory_item_id
      LEFT JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id
      JOIN admins a ON w.admin_id = a.admin_id
      ORDER BY w.created_at DESC
    `);
    return successResponse(res, rows);
  } catch (error) {
    return errorResponse(res, 'Error fetching wastage logs', 500, error);
  }
};

export const recordWastage = async (req: any, res: Response) => {
  const { product_id, menu_item_id, inventory_item_id, quantity, reason_en, reason_ar } = req.body;
  const admin_id = req.user.admin_id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Record wastage
    const [result]: any = await connection.execute(
      'INSERT INTO wastage (product_id, menu_item_id, inventory_item_id, quantity, reason_en, reason_ar, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [product_id || null, menu_item_id || null, inventory_item_id || null, quantity || 0, reason_en || null, reason_ar || null, admin_id]
    );

    // 2. Adjust inventory if it's an inventory item
    if (inventory_item_id) {
       await connection.execute(
          'UPDATE inventory_items SET current_stock = current_stock - ? WHERE inventory_item_id = ?',
          [quantity, inventory_item_id]
       );
    }

    // 3. Adjust product stock if it's a finished product
    if (product_id) {
       await connection.execute(
          'UPDATE products SET current_stock = current_stock - ? WHERE product_id = ?',
          [quantity, product_id]
       );
    }

    // 4. Adjust menu item stock if it's a finished menu item product
    if (menu_item_id) {
       await connection.execute(
          'UPDATE menu_items SET current_stock = current_stock - ? WHERE menu_item_id = ?',
          [quantity, menu_item_id]
       );
    }

    await connection.commit();
    return successResponse(res, { id: result.insertId }, 'Wastage recorded successfully', 201);
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, 'Error recording wastage', 500, error);
  } finally {
    connection.release();
  }
};
