import { Request, Response } from 'express';
import db from '../config/db';

export const getLiabilities = async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query('SELECT * FROM company_liabilities ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch liabilities', error });
  }
};

export const createLiability = async (req: Request, res: Response) => {
  const { name, type, amount, interest_rate, due_date } = req.body;
  try {
    const [result]: any = await db.query(
      'INSERT INTO company_liabilities (name, type, amount, interest_rate, due_date) VALUES (?, ?, ?, ?, ?)',
      [name, type || 'Loan', amount, interest_rate || '0%', due_date || null]
    );
    res.status(201).json({ success: true, data: { liability_id: result.insertId, name, type, amount, interest_rate, due_date } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create liability', error });
  }
};

export const updateLiability = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, type, amount, interest_rate, due_date } = req.body;
  try {
    await db.query(
      'UPDATE company_liabilities SET name=?, type=?, amount=?, interest_rate=?, due_date=? WHERE liability_id=?',
      [name, type, amount, interest_rate, due_date, id]
    );
    res.json({ success: true, message: 'Liability updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update liability', error });
  }
};
