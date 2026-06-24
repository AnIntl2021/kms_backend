"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAsset = exports.createAsset = exports.getAssets = void 0;
const db_1 = __importDefault(require("../config/db"));
const getAssets = async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT * FROM company_assets ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch assets', error });
    }
};
exports.getAssets = getAssets;
const createAsset = async (req, res) => {
    const { name, type, value, depreciation_rate, date_acquired } = req.body;
    try {
        const [result] = await db_1.default.query('INSERT INTO company_assets (name, type, value, depreciation_rate, date_acquired) VALUES (?, ?, ?, ?, ?)', [name, type || 'General', value, depreciation_rate || 0, date_acquired || new Date()]);
        res.status(201).json({ success: true, data: { asset_id: result.insertId, name, type, value, depreciation_rate, date_acquired } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create asset', error });
    }
};
exports.createAsset = createAsset;
const updateAsset = async (req, res) => {
    const { id } = req.params;
    const { name, type, value, depreciation_rate, date_acquired } = req.body;
    try {
        await db_1.default.query('UPDATE company_assets SET name=?, type=?, value=?, depreciation_rate=?, date_acquired=? WHERE asset_id=?', [name, type, value, depreciation_rate, date_acquired, id]);
        res.json({ success: true, message: 'Asset updated successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update asset', error });
    }
};
exports.updateAsset = updateAsset;
