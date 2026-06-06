import { Request, Response } from 'express';
import db from '../config/db';

export const getEmployees = async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query('SELECT * FROM employees ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch employees', error });
  }
};

export const createEmployee = async (req: Request, res: Response) => {
  const { name, role, salary } = req.body;
  try {
    const [result]: any = await db.query(
      'INSERT INTO employees (name, role, salary) VALUES (?, ?, ?)',
      [name, role || 'Staff', salary || 0]
    );
    res.status(201).json({ success: true, data: { employee_id: result.insertId, name, role, salary, status: 'active' } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create employee', error });
  }
};

export const updateEmployee = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, role, salary, status } = req.body;
  try {
    await db.query(
      'UPDATE employees SET name=?, role=?, salary=?, status=? WHERE employee_id=?',
      [name, role, salary, status || 'active', id]
    );
    res.json({ success: true, message: 'Employee updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update employee', error });
  }
};
