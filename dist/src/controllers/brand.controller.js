"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBrand = exports.updateBrand = exports.createBrand = exports.getBrands = void 0;
const response_1 = require("../utils/response");
const db_1 = __importDefault(require("../config/db"));
const getBrands = async (req, res) => {
    try {
        const user = req.user;
        let query = 'SELECT * FROM brands WHERE deleted_at IS NULL';
        const params = [];
        if (user && user.brand_id) {
            query += ' AND brand_id = ?';
            params.push(user.brand_id);
        }
        query += ' ORDER BY name_en';
        const [brands] = await db_1.default.execute(query, params);
        return (0, response_1.successResponse)(res, brands);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to fetch brands', 500, error);
    }
};
exports.getBrands = getBrands;
const createBrand = async (req, res) => {
    try {
        const { name_en, name_ar, status } = req.body;
        if (!name_en || !name_ar) {
            return (0, response_1.errorResponse)(res, 'Brand English and Arabic names are required', 400);
        }
        const [result] = await db_1.default.execute('INSERT INTO brands (name_en, name_ar, status) VALUES (?, ?, ?)', [name_en, name_ar, status || 'active']);
        return (0, response_1.successResponse)(res, { brand_id: result.insertId }, 'Brand created successfully', 201);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to create brand', 500, error);
    }
};
exports.createBrand = createBrand;
const updateBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { name_en, name_ar, status } = req.body;
        await db_1.default.execute('UPDATE brands SET name_en = ?, name_ar = ?, status = ? WHERE brand_id = ?', [name_en, name_ar, status || 'active', id]);
        return (0, response_1.successResponse)(res, null, 'Brand updated successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to update brand', 500, error);
    }
};
exports.updateBrand = updateBrand;
const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.execute('UPDATE brands SET deleted_at = CURRENT_TIMESTAMP WHERE brand_id = ?', [id]);
        return (0, response_1.successResponse)(res, null, 'Brand deleted successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to delete brand', 500, error);
    }
};
exports.deleteBrand = deleteBrand;
