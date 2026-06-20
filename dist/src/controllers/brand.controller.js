import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';
export const getBrands = async (req, res) => {
    try {
        const user = req.user;
        let query = 'SELECT * FROM brands WHERE deleted_at IS NULL';
        const params = [];
        if (user && user.brand_id) {
            query += ' AND brand_id = ?';
            params.push(user.brand_id);
        }
        query += ' ORDER BY name_en';
        const [brands] = await pool.execute(query, params);
        return successResponse(res, brands);
    }
    catch (error) {
        return errorResponse(res, 'Failed to fetch brands', 500, error);
    }
};
export const createBrand = async (req, res) => {
    try {
        const { name_en, name_ar, status } = req.body;
        if (!name_en || !name_ar) {
            return errorResponse(res, 'Brand English and Arabic names are required', 400);
        }
        const [result] = await pool.execute('INSERT INTO brands (name_en, name_ar, status) VALUES (?, ?, ?)', [name_en, name_ar, status || 'active']);
        return successResponse(res, { brand_id: result.insertId }, 'Brand created successfully', 201);
    }
    catch (error) {
        return errorResponse(res, 'Failed to create brand', 500, error);
    }
};
export const updateBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { name_en, name_ar, status } = req.body;
        await pool.execute('UPDATE brands SET name_en = ?, name_ar = ?, status = ? WHERE brand_id = ?', [name_en, name_ar, status || 'active', id]);
        return successResponse(res, null, 'Brand updated successfully');
    }
    catch (error) {
        return errorResponse(res, 'Failed to update brand', 500, error);
    }
};
export const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('UPDATE brands SET deleted_at = CURRENT_TIMESTAMP WHERE brand_id = ?', [id]);
        return successResponse(res, null, 'Brand deleted successfully');
    }
    catch (error) {
        return errorResponse(res, 'Failed to delete brand', 500, error);
    }
};
