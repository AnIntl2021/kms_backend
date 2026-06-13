import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';
export const getMenuItems = async (req, res) => {
    try {
        const [items] = await pool.execute(`
      SELECT mi.*, c.name_en as category_name 
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.category_id
      WHERE mi.deleted_at IS NULL
      ORDER BY mi.sort_order ASC, mi.name_en ASC
    `);
        return successResponse(res, items);
    }
    catch (error) {
        console.error('getMenuItems Error:', error);
        return errorResponse(res, 'Failed to fetch menu items', 500, error);
    }
};
export const getMenuItemDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const [items] = await pool.execute('SELECT * FROM menu_items WHERE menu_item_id = ?', [id]);
        if (items.length === 0)
            return errorResponse(res, 'Item not found', 404);
        const [ingredients] = await pool.execute(`
      SELECT 
        mii.*, 
        COALESCE(ii.name_en, smi.name_en) as name_en,
        COALESCE(ii.unit_en, 'Batch') as unit_en 
      FROM menu_item_ingredients mii
      LEFT JOIN inventory_items ii ON mii.inventory_item_id = ii.inventory_item_id
      LEFT JOIN menu_items smi ON mii.sub_menu_item_id = smi.menu_item_id
      WHERE mii.menu_item_id = ?
    `, [id]);
        return successResponse(res, { ...items[0], ingredients });
    }
    catch (error) {
        console.error('getMenuItemDetails Error:', error);
        return errorResponse(res, 'Failed to fetch menu details', 500, error);
    }
};
export const createMenuItem = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { name_en, name_ar, category_id, price, cost_price, description_en, description_ar, type, barcode, unit_en, unit_ar } = req.body;
        let { ingredients } = req.body;
        // Support Multipart/FormData (ingredients arrive as JSON string)
        if (typeof ingredients === 'string') {
            try {
                ingredients = JSON.parse(ingredients);
            }
            catch (e) {
                ingredients = [];
            }
        }
        const image_url = req.file ? `/uploads/menu/${req.file.filename}` : null;
        const yield_quantity = Number(req.body.yield_quantity || 1.000);
        // 1. Create Menu Item
        const [result] = await connection.execute('INSERT INTO menu_items (category_id, name_en, name_ar, barcode, price, unit_en, unit_ar, cost_price, type, description_en, description_ar, image_url, yield_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            category_id || null,
            name_en,
            name_ar,
            barcode || null,
            Number(price || 0),
            unit_en || 'piece',
            unit_ar || 'حبة',
            Number(cost_price || 0),
            type || 'selling',
            description_en || null,
            description_ar || null,
            image_url,
            yield_quantity
        ]);
        const menu_item_id = result.insertId;
        // 2. Add Ingredients (Recipe)
        if (ingredients && Array.isArray(ingredients)) {
            for (const ing of ingredients) {
                let invId = null;
                let subMenuId = null;
                const rawId = String(ing.inventory_item_id || '');
                if (rawId.startsWith('pre-')) {
                    subMenuId = rawId.replace('pre-', '');
                }
                else {
                    invId = rawId.replace('inv-', '');
                }
                if (!invId && !subMenuId)
                    continue;
                await connection.execute('INSERT INTO menu_item_ingredients (menu_item_id, inventory_item_id, sub_menu_item_id, package_id, quantity) VALUES (?, ?, ?, ?, ?)', [menu_item_id, invId, subMenuId, ing.package_id || null, ing.quantity]);
            }
        }
        await connection.commit();
        return successResponse(res, { menu_item_id }, 'Menu item created with recipe successfully!', 201);
    }
    catch (error) {
        await connection.rollback();
        console.error('⛔ createMenuItem FAILURE:', error.message);
        return errorResponse(res, `Database Error: ${error.message}`, 500, error);
    }
    finally {
        connection.release();
    }
};
export const updateMenuItem = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { id } = req.params;
        await connection.beginTransaction();
        // 1. Check if item exists
        const [existing] = await connection.execute('SELECT image_url FROM menu_items WHERE menu_item_id = ?', [id]);
        if (existing.length === 0)
            throw new Error('Item not found');
        const { name_en, name_ar, category_id, price, unit_en, unit_ar, cost_price, description_en, description_ar, status, type, barcode } = req.body;
        let ingredients = req.body.ingredients;
        if (typeof ingredients === 'string') {
            try {
                ingredients = JSON.parse(ingredients);
            }
            catch (e) {
                ingredients = [];
            }
        }
        const image_url = req.file ? `/uploads/menu/${req.file.filename}` : existing[0].image_url;
        const yield_quantity = Number(req.body.yield_quantity || 1.000);
        // 2. Update Menu Item Header
        await connection.execute(`UPDATE menu_items SET 
        category_id = ?, 
        name_en = ?, 
        name_ar = ?, 
        barcode = ?,
        price = ?, 
        unit_en = ?,
        unit_ar = ?,
        cost_price = ?, 
        type = ?,
        description_en = ?, 
        description_ar = ?, 
        image_url = ?,
        status = ?,
        yield_quantity = ?
      WHERE menu_item_id = ?`, [category_id, name_en, name_ar, barcode || null, price, unit_en || 'piece', unit_ar || 'حبة', cost_price || 0, type || 'selling', description_en || null, description_ar || null, image_url, status || 'available', yield_quantity, id]);
        // 3. Update Ingredients (Delete and Re-insert)
        await connection.execute('DELETE FROM menu_item_ingredients WHERE menu_item_id = ?', [id]);
        if (ingredients && Array.isArray(ingredients)) {
            for (const ing of ingredients) {
                let invId = null;
                let subMenuId = null;
                const rawId = String(ing.inventory_item_id || '');
                if (rawId.startsWith('pre-')) {
                    subMenuId = rawId.replace('pre-', '');
                }
                else {
                    invId = rawId.replace('inv-', '');
                }
                if (!invId && !subMenuId)
                    continue;
                await connection.execute('INSERT INTO menu_item_ingredients (menu_item_id, inventory_item_id, sub_menu_item_id, package_id, quantity) VALUES (?, ?, ?, ?, ?)', [id, invId, subMenuId, ing.package_id || null, ing.quantity]);
            }
        }
        await connection.commit();
        return successResponse(res, null, 'Menu item updated successfully');
    }
    catch (error) {
        await connection.rollback();
        return errorResponse(res, error.message || 'Failed to update menu item', 500, error);
    }
    finally {
        connection.release();
    }
};
export const deleteMenuItem = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('UPDATE menu_items SET deleted_at = CURRENT_TIMESTAMP WHERE menu_item_id = ?', [id]);
        return successResponse(res, null, 'Menu item deleted');
    }
    catch (error) {
        console.error('deleteMenuItem Error:', error);
        return errorResponse(res, 'Failed to delete menu item', 500, error);
    }
};
