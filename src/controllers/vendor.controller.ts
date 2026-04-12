import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';

export const getVendors = async (req: Request, res: Response) => {
  try {
    const [vendors]: any = await pool.execute('SELECT * FROM vendors WHERE deleted_at IS NULL ORDER BY name_en ASC');
    
    // 🛡️ BRANCH SEGREGATION ORACLE (Attach branches to each partner)
    for (const vendor of vendors) {
      const [branches] = await pool.execute('SELECT * FROM partner_branches WHERE partner_id = ? AND status = "active"', [vendor.vendor_id]);
      vendor.branches = branches;
    }
    
    return successResponse(res, vendors);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch partners', 500, error);
  }
};

export const createVendor = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { name_en, name_ar, contact_person, phone, email, address, type, status, branches } = req.body;
    
    // 1. Create Parent Partner
    const [result]: any = await connection.execute(
      'INSERT INTO vendors (name_en, name_ar, contact_person, phone, email, address, type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name_en, name_ar, contact_person, phone, email, address, type || 'supplier', status || 'active']
    );
    const partnerId = result.insertId;

    // 2. 🛡️ BOOT BRANCHES (KFC Logic - Massive Segregation)
    if (branches && Array.isArray(branches)) {
      for (const br of branches) {
        await connection.execute(
          'INSERT INTO partner_branches (partner_id, name_en, name_ar, address, contact_person, phone) VALUES (?, ?, ?, ?, ?, ?)',
          [partnerId, br.name_en, br.name_ar || br.name_en, br.address || address, br.contact_person || contact_person, br.phone || phone]
        );
      }
    }

    await connection.commit();
    return successResponse(res, { vendor_id: partnerId }, 'Partner & Branches registered successfully', 201);
  } catch (error) {
    await connection.rollback();
    console.error('Create Vendor Error:', error);
    return errorResponse(res, 'Failed to register partner network', 500, error);
  } finally {
    connection.release();
  }
};

export const updateVendor = async (req: Request, res: Response) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { name_en, name_ar, contact_person, phone, email, address, status, type, branches } = req.body;
    
    // 1. Update Parent
    await connection.execute(
      'UPDATE vendors SET name_en = ?, name_ar = ?, contact_person = ?, phone = ?, email = ?, address = ?, status = ?, type = ? WHERE vendor_id = ?',
      [name_en, name_ar, contact_person, phone, email, address, status, type, id]
    );

    // 2. 🛡️ SYNC BRANCH NETWORK
    if (branches && Array.isArray(branches)) {
      // Simple sync: Clear and re-add for absolute state truth
      await connection.execute('DELETE FROM partner_branches WHERE partner_id = ?', [id]);
      for (const br of branches) {
        await connection.execute(
          'INSERT INTO partner_branches (partner_id, name_en, name_ar, address, contact_person, phone) VALUES (?, ?, ?, ?, ?, ?)',
          [id, br.name_en, br.name_ar || br.name_en, br.address || address, br.contact_person || contact_person, br.phone || phone]
        );
      }
    }

    await connection.commit();
    return successResponse(res, null, 'Partner project updated successfully');
  } catch (error) {
    await connection.rollback();
    console.error('Update Vendor Error:', error);
    return errorResponse(res, 'Failed to update distribution network', 500, error);
  } finally {
    connection.release();
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
