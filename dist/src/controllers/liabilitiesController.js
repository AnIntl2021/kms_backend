"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLiability = exports.createLiability = exports.getLiabilities = void 0;
const db_1 = __importDefault(require("../config/db"));
const getLiabilities = async (req, res) => {
    try {
        const [rows] = await db_1.default.query('SELECT * FROM company_liabilities ORDER BY created_at DESC');
        res.json({ success: true, data: rows });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch liabilities', error });
    }
};
exports.getLiabilities = getLiabilities;
const createLiability = async (req, res) => {
    const { name, type, amount, interest_rate, due_date } = req.body;
    try {
        const [result] = await db_1.default.query('INSERT INTO company_liabilities (name, type, amount, interest_rate, due_date) VALUES (?, ?, ?, ?, ?)', [name, type || 'Loan', amount, interest_rate || '0%', due_date || null]);
        res.status(201).json({ success: true, data: { liability_id: result.insertId, name, type, amount, interest_rate, due_date } });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to create liability', error });
    }
};
exports.createLiability = createLiability;
const updateLiability = async (req, res) => {
    const { id } = req.params;
    const { name, type, amount, interest_rate, due_date } = req.body;
    try {
        await db_1.default.query('UPDATE company_liabilities SET name=?, type=?, amount=?, interest_rate=?, due_date=? WHERE liability_id=?', [name, type, amount, interest_rate, due_date, id]);
        res.json({ success: true, message: 'Liability updated successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update liability', error });
    }
};
exports.updateLiability = updateLiability;
