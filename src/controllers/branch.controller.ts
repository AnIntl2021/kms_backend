import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import pool, { masterPool } from '../config/db';
import { tenantContext } from '../middleware/tenantContext';

export const getBranches = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let query = 'SELECT * FROM branches WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (user && user.brand_id) {
      query += ' AND brand_id = ?';
      params.push(user.brand_id);
    }

    query += ' ORDER BY name_en';
    const [branches] = await pool.execute(query, params);
    return successResponse(res, branches);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch branches', 500, error);
  }
};

export const createBranch = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { name_en, name_ar, location_en, location_ar, phone } = req.body;
    let brandId = req.body.brand_id || null;

    if (user && user.brand_id) {
      brandId = user.brand_id;
    }

    // Count existing branches
    const [countRows]: any = await pool.execute('SELECT COUNT(*) as count FROM branches WHERE deleted_at IS NULL');
    const currentCount = countRows[0].count;

    // Get database name to find tenant details
    const dbName = tenantContext.getStore()?.dbName || 'kms_master';

    if (dbName !== 'kms_master') {
      const [tenantRows]: any = await masterPool.execute(
        'SELECT base_branches, extra_branches FROM tenants WHERE db_name = ?',
        [dbName]
      );
      
      if (tenantRows && tenantRows.length > 0) {
        const limit = (tenantRows[0].base_branches || 1) + (tenantRows[0].extra_branches || 0);
        if (currentCount >= limit) {
          return errorResponse(res, `Branch limit reached: Your current subscription allows a maximum of ${limit} branch(es). Please upgrade your subscription limit first.`, 403);
        }
      }
    }

    const [result]: any = await pool.execute(
      'INSERT INTO branches (name_en, name_ar, location_en, location_ar, phone, brand_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name_en, name_ar, location_en || null, location_ar || null, phone || null, brandId]
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
