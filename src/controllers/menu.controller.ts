import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';

export const getMenuItems = async (req: Request, res: Response) => {
  try {
    const [items] = await pool.execute(`
      SELECT mi.*, c.name_en as category_name 
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.category_id
      WHERE mi.deleted_at IS NULL
      ORDER BY mi.sort_order ASC, mi.name_en ASC
    `);
    return successResponse(res, items);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch menu items', 500, error);
  }
};

export const getMenuItemDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [items]: any = await pool.execute('SELECT * FROM menu_items WHERE menu_item_id = ?', [id]);
    if (items.length === 0) return errorResponse(res, 'Item not found', 404);
    
    const [ingredients] = await pool.execute(`
      SELECT mii.*, ii.name_en, ii.unit_en 
      FROM menu_item_ingredients mii
      JOIN inventory_items ii ON mii.inventory_item_id = ii.inventory_item_id
      WHERE mii.menu_item_id = ?
    `, [id]);

    return successResponse(res, { ...items[0], ingredients });
  } catch (error) {
    return errorResponse(res, 'Failed to fetch menu details', 500, error);
  }
};

export const createMenuItem = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { name_en, name_ar, category_id, price, cost_price, description_en, description_ar } = req.body;
    let { ingredients } = req.body;

    // ... (rest of parsing logic) ...

    const image_url = req.file ? `/uploads/menu/${req.file.filename}` : null;

    // 1. Create Menu Item
    const [result]: any = await connection.execute(
      'INSERT INTO menu_items (category_id, name_en, name_ar, price, cost_price, description_en, description_ar, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [category_id, name_en, name_ar, price, cost_price || 0, description_en || null, description_ar || null, image_url]
    );
    const menu_item_id = result.insertId;

    // 2. Add Ingredients (Recipe)
    if (ingredients && Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        await connection.execute(
          'INSERT INTO menu_item_ingredients (menu_item_id, inventory_item_id, quantity) VALUES (?, ?, ?)',
          [menu_item_id, ing.inventory_item_id, ing.quantity]
        );
      }
    }

    await connection.commit();
    return successResponse(res, { menu_item_id }, 'Menu item created with recipe', 201);
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, 'Failed to create menu item', 500, error);
  } finally {
    connection.release();
  }
};

export const updateMenuItem = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();
    
    // 1. Check if item exists
    const [existing]: any = await connection.execute('SELECT image_url FROM menu_items WHERE menu_item_id = ?', [id]);
    if (existing.length === 0) throw new Error('Item not found');

    const { name_en, name_ar, category_id, price, cost_price, description_en, description_ar, status } = req.body;
    let ingredients = req.body.ingredients;
    if (typeof ingredients === 'string') ingredients = JSON.parse(ingredients);

    const image_url = req.file ? `/uploads/menu/${req.file.filename}` : existing[0].image_url;

    // 2. Update Menu Item Header
    await connection.execute(
      `UPDATE menu_items SET 
        category_id = ?, 
        name_en = ?, 
        name_ar = ?, 
        price = ?, 
        cost_price = ?, 
        description_en = ?, 
        description_ar = ?, 
        image_url = ?,
        status = ?
      WHERE menu_item_id = ?`,
      [category_id, name_en, name_ar, price, cost_price || 0, description_en || null, description_ar || null, image_url, status || 'available', id]
    );

    // 3. Update Ingredients (Delete and Re-insert)
    await connection.execute('DELETE FROM menu_item_ingredients WHERE menu_item_id = ?', [id]);
    if (ingredients && Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        if (ing.inventory_item_id && ing.quantity) {
          await connection.execute(
            'INSERT INTO menu_item_ingredients (menu_item_id, inventory_item_id, quantity) VALUES (?, ?, ?)',
            [id, ing.inventory_item_id, ing.quantity]
          );
        }
      }
    }

    await connection.commit();
    return successResponse(res, null, 'Menu item updated successfully');
  } catch (error: any) {
    await connection.rollback();
    return errorResponse(res, error.message || 'Failed to update menu item', 500, error);
  } finally {
    connection.release();
  }
};

export const deleteMenuItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE menu_items SET deleted_at = CURRENT_TIMESTAMP WHERE menu_item_id = ?', [id]);
    return successResponse(res, null, 'Menu item deleted');
  } catch (error) {
    return errorResponse(res, 'Failed to delete menu item', 500, error);
  }
};
