import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';
export const getCategories = async (req, res) => {
    try {
        const { parent_only } = req.query;
        let query = 'SELECT * FROM categories WHERE deleted_at IS NULL';
        const params = [];
        if (parent_only === 'true') {
            query += ' AND parent_id IS NULL';
        }
        query += ' ORDER BY sort_order ASC, name_en ASC';
        const [categories] = await pool.execute(query, params);
        return successResponse(res, categories);
    }
    catch (error) {
        return errorResponse(res, 'Failed to fetch categories', 500, error);
    }
};
export const createCategory = async (req, res) => {
    try {
        const { name_en, name_ar, sort_order, parent_id } = req.body;
        const [result] = await pool.execute('INSERT INTO categories (name_en, name_ar, sort_order, parent_id) VALUES (?, ?, ?, ?)', [name_en, name_ar, sort_order || 0, parent_id || null]);
        return successResponse(res, { category_id: result.insertId }, 'Category created successfully', 201);
    }
    catch (error) {
        return errorResponse(res, 'Failed to create category', 500, error);
    }
};
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name_en, name_ar, sort_order, parent_id } = req.body;
        await pool.execute('UPDATE categories SET name_en = ?, name_ar = ?, sort_order = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE category_id = ?', [name_en, name_ar, sort_order, parent_id || null, id]);
        return successResponse(res, null, 'Category updated successfully');
    }
    catch (error) {
        return errorResponse(res, 'Failed to update category', 500, error);
    }
};
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete
        await pool.execute('UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE category_id = ?', [id]);
        return successResponse(res, null, 'Category deleted successfully');
    }
    catch (error) {
        return errorResponse(res, 'Failed to delete category', 500, error);
    }
};
