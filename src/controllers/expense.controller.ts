import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM operational_expenses ORDER BY expense_date DESC, created_at DESC');
    return successResponse(res, rows);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch expenses', 500, error);
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    const { type, category, amount, expense_date, description } = req.body;
    
    if (!type || !category || !amount || !expense_date) {
      return errorResponse(res, 'Missing required fields', 400);
    }

    const [result]: any = await pool.execute(
      'INSERT INTO operational_expenses (type, category, amount, expense_date, description) VALUES (?, ?, ?, ?, ?)',
      [type, category, amount, expense_date, description || null]
    );

    return successResponse(res, { expense_id: result.insertId }, 'Expense logged successfully', 201);
  } catch (error) {
    return errorResponse(res, 'Failed to create expense', 500, error);
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM operational_expenses WHERE expense_id = ?', [id]);
    return successResponse(res, null, 'Expense deleted successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to delete expense', 500, error);
  }
};
