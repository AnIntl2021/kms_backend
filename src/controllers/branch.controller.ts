import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';

export const getBranches = async (req: Request, res: Response) => {
  try {
    const [branches] = await pool.execute('SELECT * FROM branches WHERE deleted_at IS NULL ORDER BY name_en');
    return successResponse(res, branches);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch branches', 500, error);
  }
};

export const createBranch = async (req: Request, res: Response) => {
  try {
    const { name_en, name_ar, location_en, location_ar, phone } = req.body;
    const [result]: any = await pool.execute(
      'INSERT INTO branches (name_en, name_ar, location_en, location_ar, phone) VALUES (?, ?, ?, ?, ?)',
      [name_en, name_ar, location_en || null, location_ar || null, phone || null]
    );
    return successResponse(res, { branch_id: result.insertId }, 'Branch created successfully', 201);
  } catch (error) {
    return errorResponse(res, 'Failed to create branch', 500, error);
  }
};

export const updateBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name_en, name_ar, location_en, location_ar, phone, status } = req.body;
    await pool.execute(
      `UPDATE branches SET name_en = ?, name_ar = ?, location_en = ?, location_ar = ?, phone = ?, status = ? 
       WHERE branch_id = ?`,
      [name_en, name_ar, location_en || null, location_ar || null, phone || null, status || 'active', id]
    );
    return successResponse(res, null, 'Branch updated successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to update branch', 500, error);
  }
};

export const deleteBranch = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE branches SET deleted_at = CURRENT_TIMESTAMP WHERE branch_id = ?', [id]);
    return successResponse(res, null, 'Branch deleted successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to delete branch', 500, error);
  }
};
