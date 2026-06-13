import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';
export const createRole = async (req, res) => {
    try {
        const { role_name, display_name_en, display_name_ar, permissions } = req.body;
        // Check if role name exists
        const [existing] = await pool.execute('SELECT role_id FROM roles WHERE role_name = ?', [role_name]);
        if (existing.length > 0)
            return errorResponse(res, 'Role name already exists', 400);
        const permsJson = JSON.stringify(permissions || []);
        const [result] = await pool.execute('INSERT INTO roles (role_name, display_name_en, display_name_ar, permissions) VALUES (?, ?, ?, ?)', [role_name, display_name_en, display_name_ar || display_name_en, permsJson]);
        return successResponse(res, { role_id: result.insertId }, 'Role created successfully', 201);
    }
    catch (error) {
        console.error("Create Role Error:", error);
        return errorResponse(res, `Failed to create role: ${error.message || 'Unknown error'}`, 500, error);
    }
};
export const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_name, display_name_en, display_name_ar, permissions } = req.body;
        const permsJson = JSON.stringify(permissions || []);
        await pool.execute('UPDATE roles SET role_name=?, display_name_en=?, display_name_ar=?, permissions=? WHERE role_id=?', [role_name, display_name_en, display_name_ar || display_name_en, permsJson, id]);
        return successResponse(res, null, 'Role updated successfully');
    }
    catch (error) {
        return errorResponse(res, 'Failed to update role', 500, error);
    }
};
export const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if role is used by any admins
        const [users] = await pool.execute('SELECT admin_id FROM admins WHERE role_id = ? AND deleted_at IS NULL', [id]);
        if (users.length > 0)
            return errorResponse(res, 'Cannot delete role as it is assigned to active users', 400);
        await pool.execute('UPDATE roles SET deleted_at=CURRENT_TIMESTAMP WHERE role_id=?', [id]);
        return successResponse(res, null, 'Role deleted successfully');
    }
    catch (error) {
        return errorResponse(res, 'Failed to delete role', 500, error);
    }
};
