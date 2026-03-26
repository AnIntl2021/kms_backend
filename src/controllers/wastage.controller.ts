import { Request, Response } from 'express';
import pool from '../config/db';

export const getWastageLogs = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute(`
      SELECT w.*, 
             p.name_en as product_name_en, p.name_ar as product_name_ar,
             ii.name_en as item_name_en, ii.name_ar as item_name_ar,
             a.username as admin_name
      FROM wastage w
      LEFT JOIN products p ON w.product_id = p.product_id
      LEFT JOIN inventory_items ii ON w.inventory_item_id = ii.inventory_item_id
      JOIN admins a ON w.admin_id = a.admin_id
      ORDER BY w.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching wastage logs', error });
  }
};

export const recordWastage = async (req: any, res: Response) => {
  const { product_id, inventory_item_id, quantity, reason_en, reason_ar } = req.body;
  const admin_id = req.user.admin_id;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Record wastage
    const [result]: any = await connection.execute(
      'INSERT INTO wastage (product_id, inventory_item_id, quantity, reason_en, reason_ar, admin_id) VALUES (?, ?, ?, ?, ?, ?)',
      [product_id || null, inventory_item_id || null, quantity, reason_en, reason_ar, admin_id]
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

    await connection.commit();
    res.status(201).json({ message: 'Wastage recorded successfully', id: result.insertId });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Error recording wastage', error });
  } finally {
    connection.release();
  }
};
