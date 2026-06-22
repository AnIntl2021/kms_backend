"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = void 0;
const response_1 = require("../utils/response");
const db_1 = __importDefault(require("../config/db"));
const getCategories = async (req, res) => {
    try {
        const { parent_only } = req.query;
        let query = 'SELECT * FROM categories WHERE deleted_at IS NULL';
        const params = [];
        if (parent_only === 'true') {
            query += ' AND parent_id IS NULL';
        }
        query += ' ORDER BY sort_order ASC, name_en ASC';
        const [categories] = await db_1.default.execute(query, params);
        return (0, response_1.successResponse)(res, categories);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to fetch categories', 500, error);
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res) => {
    try {
        const { name_en, name_ar, sort_order, parent_id } = req.body;
        const [result] = await db_1.default.execute('INSERT INTO categories (name_en, name_ar, sort_order, parent_id) VALUES (?, ?, ?, ?)', [name_en, name_ar, sort_order || 0, parent_id || null]);
        return (0, response_1.successResponse)(res, { category_id: result.insertId }, 'Category created successfully', 201);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to create category', 500, error);
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name_en, name_ar, sort_order, parent_id } = req.body;
        await db_1.default.execute('UPDATE categories SET name_en = ?, name_ar = ?, sort_order = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE category_id = ?', [name_en, name_ar, sort_order, parent_id || null, id]);
        return (0, response_1.successResponse)(res, null, 'Category updated successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to update category', 500, error);
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        // Soft delete
        await db_1.default.execute('UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE category_id = ?', [id]);
        return (0, response_1.successResponse)(res, null, 'Category deleted successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to delete category', 500, error);
    }
};
exports.deleteCategory = deleteCategory;
