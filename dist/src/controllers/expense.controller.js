"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpense = exports.createExpense = exports.getExpenses = void 0;
const db_1 = __importDefault(require("../config/db"));
const response_1 = require("../utils/response");
const getExpenses = async (req, res) => {
    try {
        const [rows] = await db_1.default.execute('SELECT * FROM operational_expenses ORDER BY expense_date DESC, created_at DESC');
        return (0, response_1.successResponse)(res, rows);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to fetch expenses', 500, error);
    }
};
exports.getExpenses = getExpenses;
const createExpense = async (req, res) => {
    try {
        const { type, category, amount, expense_date, description } = req.body;
        if (!type || !category || !amount || !expense_date) {
            return (0, response_1.errorResponse)(res, 'Missing required fields', 400);
        }
        const [result] = await db_1.default.execute('INSERT INTO operational_expenses (type, category, amount, expense_date, description) VALUES (?, ?, ?, ?, ?)', [type, category, amount, expense_date, description || null]);
        return (0, response_1.successResponse)(res, { expense_id: result.insertId }, 'Expense logged successfully', 201);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to create expense', 500, error);
    }
};
exports.createExpense = createExpense;
const deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        await db_1.default.execute('DELETE FROM operational_expenses WHERE expense_id = ?', [id]);
        return (0, response_1.successResponse)(res, null, 'Expense deleted successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to delete expense', 500, error);
    }
};
exports.deleteExpense = deleteExpense;
