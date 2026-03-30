import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';

export const getVendors = async (req: Request, res: Response) => {
  try {
    const [vendors] = await pool.execute('SELECT * FROM vendors WHERE deleted_at IS NULL ORDER BY name_en ASC');
    return successResponse(res, vendors);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch vendors', 500, error);
  }
};

export const createVendor = async (req: Request, res: Response) => {
  try {
    const { name_en, name_ar, contact_person, phone, email, address, type, status } = req.body;
    const [result]: any = await pool.execute(
      'INSERT INTO vendors (name_en, name_ar, contact_person, phone, email, address, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name_en, name_ar, contact_person, phone, email, address, type || 'supplier', status || 'active']
    );
    return successResponse(res, { vendor_id: result.insertId }, 'Partner registered successfully', 201);
  } catch (error) {
    return errorResponse(res, 'Failed to register partner', 500, error);
  }
};

export const updateVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name_en, name_ar, contact_person, phone, email, address, status, type } = req.body;
    await pool.execute(
      'UPDATE vendors SET name_en = ?, name_ar = ?, contact_person = ?, phone = ?, email = ?, address = ?, status = ?, type = ? WHERE vendor_id = ?',
      [name_en, name_ar, contact_person, phone, email, address, status, type, id]
    );
    return successResponse(res, null, 'Partner updated successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to update partner', 500, error);
  }
};

export const deleteVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE vendors SET deleted_at = CURRENT_TIMESTAMP WHERE vendor_id = ?', [id]);
    return successResponse(res, null, 'Partner removed successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to remove partner', 500, error);
  }
};
