"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProducts = void 0;
const response_1 = require("../utils/response");
const db_1 = __importDefault(require("../config/db"));
const audit_1 = require("../utils/audit");
const getProducts = async (req, res) => {
    try {
        const { category_id, sort = 'sort_order', order = 'ASC' } = req.query;
        let query = `
      SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.category_id 
      WHERE p.deleted_at IS NULL
    `;
        const params = [];
        if (category_id) {
            query += ' AND p.category_id = ?';
            params.push(category_id);
        }
        query += ` ORDER BY ${sort} ${order === 'DESC' ? 'DESC' : 'ASC'}`;
        const [products] = await db_1.default.execute(query, params);
        return (0, response_1.successResponse)(res, products);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to fetch products', 500, error);
    }
};
exports.getProducts = getProducts;
const createProduct = async (req, res) => {
    try {
        const { name_en, name_ar, category_id, base_price, sku, sort_order } = req.body;
        const [result] = await db_1.default.execute(`INSERT INTO products (name_en, name_ar, category_id, base_price, sku, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?)`, [name_en, name_ar, category_id, base_price, sku, sort_order || 0]);
        const productId = result.insertId;
        await (0, audit_1.logAudit)(req.user.admin_id, 'CREATE_PRODUCT', 'products', productId, null, req.body, req);
        return (0, response_1.successResponse)(res, { product_id: productId }, 'Product created successfully', 201);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to create product', 500, error);
    }
};
exports.createProduct = createProduct;
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name_en, name_ar, base_price, sort_order } = req.body;
        const [oldRows] = await db_1.default.execute('SELECT * FROM products WHERE product_id = ?', [id]);
        const oldData = oldRows[0];
        await db_1.default.execute(`UPDATE products 
       SET name_en = ?, name_ar = ?, base_price = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE product_id = ?`, [name_en, name_ar, base_price, sort_order, id]);
        await (0, audit_1.logAudit)(req.user.admin_id, 'UPDATE_PRODUCT', 'products', parseInt(id), oldData, req.body, req);
        return (0, response_1.successResponse)(res, null, 'Product updated successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to update product', 500, error);
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.execute('UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE product_id = ?', [id]);
        await (0, audit_1.logAudit)(req.user.admin_id, 'DELETE_PRODUCT', 'products', parseInt(id), { status: 'active' }, { status: 'deleted' }, req);
        return (0, response_1.successResponse)(res, null, 'Product deleted successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to delete product', 500, error);
    }
};
exports.deleteProduct = deleteProduct;
