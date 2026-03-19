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
    const { name_en, name_ar, contact_person, phone, email, address } = req.body;
    const [result]: any = await pool.execute(
      'INSERT INTO vendors (name_en, name_ar, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?, ?)',
      [name_en, name_ar, contact_person, phone, email, address]
    );
    return successResponse(res, { vendor_id: result.insertId }, 'Vendor created successfully', 201);
  } catch (error) {
    return errorResponse(res, 'Failed to create vendor', 500, error);
  }
};

export const updateVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name_en, name_ar, contact_person, phone, email, address, status } = req.body;
    await pool.execute(
      'UPDATE vendors SET name_en = ?, name_ar = ?, contact_person = ?, phone = ?, email = ?, address = ?, status = ? WHERE vendor_id = ?',
      [name_en, name_ar, contact_person, phone, email, address, status, id]
    );
    return successResponse(res, null, 'Vendor updated successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to update vendor', 500, error);
  }
};

export const deleteVendor = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.execute('UPDATE vendors SET deleted_at = CURRENT_TIMESTAMP WHERE vendor_id = ?', [id]);
    return successResponse(res, null, 'Vendor deleted successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to delete vendor', 500, error);
  }
};
