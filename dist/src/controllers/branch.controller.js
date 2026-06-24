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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBranch = exports.updateBranch = exports.createBranch = exports.getBranches = void 0;
const response_1 = require("../utils/response");
const db_1 = __importStar(require("../config/db"));
const tenantContext_1 = require("../middleware/tenantContext");
const getBranches = async (req, res) => {
    try {
        const user = req.user;
        let query = 'SELECT * FROM branches WHERE deleted_at IS NULL';
        const params = [];
        if (user && user.brand_id) {
            query += ' AND brand_id = ?';
            params.push(user.brand_id);
        }
        query += ' ORDER BY name_en';
        const [branches] = await db_1.default.execute(query, params);
        return (0, response_1.successResponse)(res, branches);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to fetch branches', 500, error);
    }
};
exports.getBranches = getBranches;
const createBranch = async (req, res) => {
    try {
        const user = req.user;
        const { name_en, name_ar, location_en, location_ar, phone } = req.body;
        let brandId = req.body.brand_id || null;
        if (user && user.brand_id) {
            brandId = user.brand_id;
        }
        // Count existing branches
        const [countRows] = await db_1.default.execute('SELECT COUNT(*) as count FROM branches WHERE deleted_at IS NULL');
        const currentCount = countRows[0].count;
        // Get database name to find tenant details
        const dbName = tenantContext_1.tenantContext.getStore()?.dbName || 'kms_master';
        if (dbName !== 'kms_master') {
            const [tenantRows] = await db_1.masterPool.execute('SELECT base_branches, extra_branches FROM tenants WHERE db_name = ?', [dbName]);
            if (tenantRows && tenantRows.length > 0) {
                const limit = (tenantRows[0].base_branches || 1) + (tenantRows[0].extra_branches || 0);
                if (currentCount >= limit) {
                    return (0, response_1.errorResponse)(res, `Branch limit reached: Your current subscription allows a maximum of ${limit} branch(es). Please upgrade your subscription limit first.`, 403);
                }
            }
        }
        const [result] = await db_1.default.execute('INSERT INTO branches (name_en, name_ar, location_en, location_ar, phone, brand_id) VALUES (?, ?, ?, ?, ?, ?)', [name_en, name_ar, location_en || null, location_ar || null, phone || null, brandId]);
        return (0, response_1.successResponse)(res, { branch_id: result.insertId }, 'Branch created successfully', 201);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to create branch', 500, error);
    }
};
exports.createBranch = createBranch;
const updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const { name_en, name_ar, location_en, location_ar, phone, status } = req.body;
        await db_1.default.execute(`UPDATE branches SET name_en = ?, name_ar = ?, location_en = ?, location_ar = ?, phone = ?, status = ? 
       WHERE branch_id = ?`, [name_en, name_ar, location_en || null, location_ar || null, phone || null, status || 'active', id]);
        return (0, response_1.successResponse)(res, null, 'Branch updated successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to update branch', 500, error);
    }
};
exports.updateBranch = updateBranch;
const deleteBranch = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.execute('UPDATE branches SET deleted_at = CURRENT_TIMESTAMP WHERE branch_id = ?', [id]);
        return (0, response_1.successResponse)(res, null, 'Branch deleted successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to delete branch', 500, error);
    }
};
exports.deleteBranch = deleteBranch;
