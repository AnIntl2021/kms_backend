"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRole = exports.updateRole = exports.createRole = void 0;
const db_1 = __importDefault(require("../config/db"));
const response_1 = require("../utils/response");
const createRole = async (req, res) => {
    try {
        const { role_name, display_name_en, display_name_ar, permissions } = req.body;
        // Check if role name exists
        const [existing] = await db_1.default.execute('SELECT role_id FROM roles WHERE role_name = ?', [role_name]);
        if (existing.length > 0)
            return (0, response_1.errorResponse)(res, 'Role name already exists', 400);
        const permsJson = JSON.stringify(permissions || []);
        const [result] = await db_1.default.execute('INSERT INTO roles (role_name, display_name_en, display_name_ar, permissions) VALUES (?, ?, ?, ?)', [role_name, display_name_en, display_name_ar || display_name_en, permsJson]);
        return (0, response_1.successResponse)(res, { role_id: result.insertId }, 'Role created successfully', 201);
    }
    catch (error) {
        console.error("Create Role Error:", error);
        return (0, response_1.errorResponse)(res, `Failed to create role: ${error.message || 'Unknown error'}`, 500, error);
    }
};
exports.createRole = createRole;
const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_name, display_name_en, display_name_ar, permissions } = req.body;
        const permsJson = JSON.stringify(permissions || []);
        await db_1.default.execute('UPDATE roles SET role_name=?, display_name_en=?, display_name_ar=?, permissions=? WHERE role_id=?', [role_name, display_name_en, display_name_ar || display_name_en, permsJson, id]);
        return (0, response_1.successResponse)(res, null, 'Role updated successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to update role', 500, error);
    }
};
exports.updateRole = updateRole;
const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;
        // Check if role is used by any admins
        const [users] = await db_1.default.execute('SELECT admin_id FROM admins WHERE role_id = ? AND deleted_at IS NULL', [id]);
        if (users.length > 0)
            return (0, response_1.errorResponse)(res, 'Cannot delete role as it is assigned to active users', 400);
        await db_1.default.execute('UPDATE roles SET deleted_at=CURRENT_TIMESTAMP WHERE role_id=?', [id]);
        return (0, response_1.successResponse)(res, null, 'Role deleted successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to delete role', 500, error);
    }
};
exports.deleteRole = deleteRole;
