"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInventoryPackages = exports.adjustStock = exports.deleteInventoryItem = exports.updateInventoryItem = exports.createInventoryItem = exports.getInventoryItems = void 0;
const response_1 = require("../utils/response");
const db_1 = __importDefault(require("../config/db"));
const audit_1 = require("../utils/audit");
const getInventoryItems = async (req, res) => {
    try {
        const user = req.user;
        const { category_id, search } = req.query;
        let query = `
      SELECT i.*, c.name_en as category_name_en, c.name_ar as category_name_ar,
      (SELECT cost_per_unit FROM inventory_batches WHERE inventory_item_id = i.inventory_item_id AND status = 'active' ORDER BY created_at ASC LIMIT 1) as dynamic_cost_price
      FROM inventory_items i 
      LEFT JOIN categories c ON i.category_id = c.category_id 
      WHERE i.deleted_at IS NULL
    `;
        const params = [];
        if (category_id) {
            query += ' AND i.category_id = ?';
            params.push(category_id);
        }
        if (search) {
            query += ' AND (i.name_en LIKE ? OR i.name_ar LIKE ? OR i.sku LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam);
        }
        if (user && user.brand_id) {
            query += ' AND i.brand_id = ?';
            params.push(user.brand_id);
        }
        else if (req.query.brand_id) {
            query += ' AND i.brand_id = ?';
            params.push(req.query.brand_id);
        }
        query += ' ORDER BY i.sort_order ASC, i.name_en ASC';
        const [items] = await db_1.default.execute(query, params);
        return (0, response_1.successResponse)(res, items);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to fetch inventory items', 500, error);
    }
};
exports.getInventoryItems = getInventoryItems;
const createInventoryItem = async (req, res) => {
    const connection = await db_1.default.getConnection();
    try {
        await connection.beginTransaction();
        const user = req.user;
        const { name_en, name_ar, sku, category_id, current_stock, min_stock_level, unit_en, unit_ar, cost_price, sort_order, packages } = req.body;
        let brandId = req.body.brand_id || null;
        if (user && user.brand_id) {
            brandId = user.brand_id;
        }
        const [result] = await connection.execute(`INSERT INTO inventory_items (name_en, name_ar, sku, category_id, current_stock, min_stock_level, unit_en, unit_ar, cost_price, sort_order, brand_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [name_en, name_ar, sku, category_id, current_stock || 0, min_stock_level || 5.0, unit_en || 'kg', unit_ar || 'كجم', cost_price || 0, sort_order || 0, brandId]);
        const itemId = result.insertId;
        if (packages && Array.isArray(packages)) {
            for (const pkg of packages) {
                await connection.execute(`INSERT INTO inventory_item_packages (inventory_item_id, name_en, name_ar, multiplier, parent_name, base_price) 
           VALUES (?, ?, ?, ?, ?, ?)`, [itemId, pkg.name_en, pkg.name_en, pkg.multiplier || 1.0, pkg.parent_name || null, cost_price || 0]);
            }
        }
        await connection.commit();
        await (0, audit_1.logAudit)(req.user.admin_id, 'CREATE_INVENTORY_ITEM', 'inventory_items', itemId, null, req.body, req);
        return (0, response_1.successResponse)(res, { inventory_item_id: itemId }, 'Inventory item created successfully', 201);
    }
    catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return (0, response_1.errorResponse)(res, 'SKU already exists', 400);
        }
        return (0, response_1.errorResponse)(res, 'Failed to create inventory item', 500, error);
    }
    finally {
        connection.release();
    }
};
exports.createInventoryItem = createInventoryItem;
const updateInventoryItem = async (req, res) => {
    const connection = await db_1.default.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { name_en, name_ar, sku, category_id, min_stock_level, unit_en, unit_ar, cost_price, sort_order, packages } = req.body;
        const [oldRows] = await connection.execute('SELECT * FROM inventory_items WHERE inventory_item_id = ?', [id]);
        if (oldRows.length === 0) {
            return (0, response_1.errorResponse)(res, 'Inventory item not found', 404);
        }
        const oldData = oldRows[0];
        await connection.execute(`UPDATE inventory_items 
       SET name_en = ?, name_ar = ?, sku = ?, category_id = ?, min_stock_level = ?, unit_en = ?, unit_ar = ?, cost_price = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE inventory_item_id = ?`, [
            name_en || oldData.name_en,
            name_ar || oldData.name_ar,
            sku || oldData.sku,
            category_id || oldData.category_id,
            min_stock_level !== undefined ? min_stock_level : oldData.min_stock_level,
            unit_en || oldData.unit_en,
            unit_ar || oldData.unit_ar,
            cost_price !== undefined ? cost_price : oldData.cost_price,
            sort_order !== undefined ? sort_order : oldData.sort_order,
            id
        ]);
        if (packages && Array.isArray(packages)) {
            // 1. Get current active package IDs in DB
            const [currentPkgsRows] = await connection.execute('SELECT package_id FROM inventory_item_packages WHERE inventory_item_id = ? AND deleted_at IS NULL', [id]);
            const currentPkgIdsInDB = currentPkgsRows.map((r) => r.package_id);
            const payloadPkgIds = packages.filter(p => p.id).map(p => p.id);
            // 2. Soft-delete packages that are no longer in the payload
            const idsToDelete = currentPkgIdsInDB.filter((idInDB) => !payloadPkgIds.includes(idInDB));
            if (idsToDelete.length > 0) {
                await connection.execute(`UPDATE inventory_item_packages SET deleted_at = CURRENT_TIMESTAMP WHERE package_id IN (${idsToDelete.join(',')})`);
            }
            // 3. Update existing OR Insert new
            for (const pkg of packages) {
                if (pkg.id) {
                    // Update existing
                    await connection.execute(`UPDATE inventory_item_packages SET name_en = ?, name_ar = ?, multiplier = ?, parent_name = ?, base_price = ?, updated_at = CURRENT_TIMESTAMP WHERE package_id = ?`, [pkg.name_en, pkg.name_en, pkg.multiplier || 1.0, pkg.parent_name || null, cost_price || 0, pkg.id]);
                }
                else {
                    // Insert new
                    await connection.execute(`INSERT INTO inventory_item_packages (inventory_item_id, name_en, name_ar, multiplier, parent_name, base_price) VALUES (?, ?, ?, ?, ?, ?)`, [id, pkg.name_en, pkg.name_en, pkg.multiplier || 1.0, pkg.parent_name || null, cost_price || 0]);
                }
            }
        }
        await connection.commit();
        await (0, audit_1.logAudit)(req.user.admin_id, 'UPDATE_INVENTORY_ITEM', 'inventory_items', parseInt(id), oldData, req.body, req);
        return (0, response_1.successResponse)(res, null, 'Inventory item updated successfully');
    }
    catch (error) {
        await connection.rollback();
        console.error('Update Inventory Error:', error);
        return (0, response_1.errorResponse)(res, 'Failed to update inventory item', 500, error);
    }
    finally {
        connection.release();
    }
};
exports.updateInventoryItem = updateInventoryItem;
const deleteInventoryItem = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.execute('UPDATE inventory_items SET deleted_at = CURRENT_TIMESTAMP WHERE inventory_item_id = ?', [id]);
        await (0, audit_1.logAudit)(req.user.admin_id, 'DELETE_INVENTORY_ITEM', 'inventory_items', parseInt(id), { status: 'active' }, { status: 'deleted' }, req);
        return (0, response_1.successResponse)(res, null, 'Inventory item deleted successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to delete inventory item', 500, error);
    }
};
exports.deleteInventoryItem = deleteInventoryItem;
const adjustStock = async (req, res) => {
    try {
        const { id } = req.params;
        const { adjustment_type, quantity, reason } = req.body; // type: 'add' or 'subtract'
        const [rows] = await db_1.default.execute('SELECT current_stock FROM inventory_items WHERE inventory_item_id = ?', [id]);
        if (rows.length === 0) {
            return (0, response_1.errorResponse)(res, 'Inventory item not found', 404);
        }
        const currentStock = parseFloat(rows[0].current_stock);
        const adjustQty = parseFloat(quantity);
        const newStock = adjustment_type === 'add' ? currentStock + adjustQty : currentStock - adjustQty;
        await db_1.default.execute('UPDATE inventory_items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE inventory_item_id = ?', [newStock, id]);
        // 🔔 REAL-TIME STOCK AUDIT
        Promise.resolve().then(() => __importStar(require('../utils/notifications.js'))).then(m => m.checkAndNotifyLowStock(Number(id)));
        await (0, audit_1.logAudit)(req.user.admin_id, 'STOCK_ADJUSTMENT', 'inventory_items', parseInt(id), { old_stock: currentStock }, { new_stock: newStock, type: adjustment_type, reason }, req);
        return (0, response_1.successResponse)(res, { new_stock: newStock }, 'Stock adjusted successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to adjust stock', 500, error);
    }
};
exports.adjustStock = adjustStock;
const getInventoryPackages = async (req, res) => {
    try {
        const { inventory_item_id } = req.query;
        let query = 'SELECT * FROM inventory_item_packages WHERE deleted_at IS NULL';
        const params = [];
        if (inventory_item_id) {
            query += ' AND inventory_item_id = ?';
            params.push(inventory_item_id);
        }
        const [packages] = await db_1.default.execute(query, params);
        return (0, response_1.successResponse)(res, packages);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to fetch inventory packages', 500, error);
    }
};
exports.getInventoryPackages = getInventoryPackages;
