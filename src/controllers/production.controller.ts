import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const getProductionLogs = async (req: Request, res: Response) => {
  try {
    const [logs]: any = await pool.execute(`
      SELECT 
        pl.production_id, pl.batch_number, pl.production_date, pl.expiry_date,
        COUNT(pi.menu_item_id) as total_items,
        SUM(pi.quantity_produced) as total_qty,
        GROUP_CONCAT(CONCAT(mi.name_en, ' (', pi.quantity_produced, ')') SEPARATOR ', ') as product_summary
      FROM production_logs pl
      LEFT JOIN production_items pi ON pl.production_id = pi.production_id
      LEFT JOIN menu_items mi ON pi.menu_item_id = mi.menu_item_id
      GROUP BY pl.production_id
      ORDER BY pl.production_date DESC
    `);
    return successResponse(res, logs);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch production logs', 500, error);
  }
};

export const recordBatchProduction = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { production_date, expiry_date, items } = req.body; 
    const batch_number = `B-PROD-${Date.now()}`;

    // Fix parameter order: batch_number, production_date, expiry_date
    const [result]: any = await connection.execute(
      'INSERT INTO production_logs (batch_number, production_date, expiry_date) VALUES (?, ?, ?)',
      [batch_number, production_date || new Date().toISOString().split('T')[0], expiry_date]
    );
    const production_id = result.insertId;

    if (items && Array.isArray(items)) {
      for (const item of items) {
        await connection.execute(
          'INSERT INTO production_items (production_id, menu_item_id, quantity_produced) VALUES (?, ?, ?)',
          [production_id, item.menu_item_id, item.quantity]
        );

        await connection.execute(
          'UPDATE menu_items SET current_stock = current_stock + ? WHERE menu_item_id = ?',
          [item.quantity, item.menu_item_id]
        );

        const [ingredients]: any = await connection.execute(
          'SELECT inventory_item_id, quantity FROM menu_item_ingredients WHERE menu_item_id = ?',
          [item.menu_item_id]
        );
        for (const ing of ingredients) {
          await connection.execute(
            'UPDATE inventory_items SET current_stock = current_stock - ? WHERE inventory_item_id = ?',
            [ing.quantity * item.quantity, ing.inventory_item_id]
          );
        }
      }
    }

    await connection.commit();
    return successResponse(res, { production_id, batch_number }, 'Batch production recorded successfully!');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Production failed');
  } finally {
    connection.release();
  }
};
