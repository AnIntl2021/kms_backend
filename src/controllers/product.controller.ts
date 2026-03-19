import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';
import { logAudit } from '../utils/audit';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { category_id, sort = 'sort_order', order = 'ASC' } = req.query;
    
    let query = `
      SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.category_id 
      WHERE p.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (category_id) {
      query += ' AND p.category_id = ?';
      params.push(category_id);
    }

    query += ` ORDER BY ${sort} ${order === 'DESC' ? 'DESC' : 'ASC'}`;

    const [products] = await pool.execute(query, params);
    return successResponse(res, products);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch products', 500, error);
  }
};

export const createProduct = async (req: any, res: Response) => {
  try {
    const { name_en, name_ar, category_id, base_price, sku, sort_order } = req.body;

    const [result]: any = await pool.execute(
      `INSERT INTO products (name_en, name_ar, category_id, base_price, sku, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name_en, name_ar, category_id, base_price, sku, sort_order || 0]
    );

    const productId = result.insertId;

    await logAudit(req.user.admin_id, 'CREATE_PRODUCT', 'products', productId, null, req.body, req);

    return successResponse(res, { product_id: productId }, 'Product created successfully', 201);
  } catch (error) {
    return errorResponse(res, 'Failed to create product', 500, error);
  }
};

export const updateProduct = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { name_en, name_ar, base_price, sort_order } = req.body;

    const [oldRows]: any = await pool.execute('SELECT * FROM products WHERE product_id = ?', [id]);
    const oldData = oldRows[0];

    await pool.execute(
      `UPDATE products 
       SET name_en = ?, name_ar = ?, base_price = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE product_id = ?`,
      [name_en, name_ar, base_price, sort_order, id]
    );

    await logAudit(req.user.admin_id, 'UPDATE_PRODUCT', 'products', parseInt(id), oldData, req.body, req);

    return successResponse(res, null, 'Product updated successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to update product', 500, error);
  }
};

export const deleteProduct = async (req: any, res: Response) => {
  try {
    const { id } = req.params;

    await pool.execute(
      'UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE product_id = ?',
      [id]
    );

    await logAudit(req.user.admin_id, 'DELETE_PRODUCT', 'products', parseInt(id), { status: 'active' }, { status: 'deleted' }, req);

    return successResponse(res, null, 'Product deleted successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to delete product', 500, error);
  }
};
