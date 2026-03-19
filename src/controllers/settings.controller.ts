import { Request, Response } from 'express';
import { successResponse, errorResponse } from '../utils/response';
import pool from '../config/db';
import { logAudit } from '../utils/audit';

export const getSettings = async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.execute('SELECT setting_key, setting_value FROM system_settings');
    const settings = rows.reduce((acc: any, row: any) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});
    
    return successResponse(res, settings);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch settings', 500, error);
  }
};

export const updateSetting = async (req: any, res: Response) => {
  try {
    const { key, value } = req.body;
    
    const [oldRows]: any = await pool.execute('SELECT setting_value FROM system_settings WHERE setting_key = ?', [key]);
    const oldValue = oldRows[0]?.setting_value;

    await pool.execute(
      'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
      [value, key]
    );

    await logAudit(req.user.admin_id, 'UPDATE_SETTING', 'system_settings', null, { [key]: oldValue }, { [key]: value }, req);

    return successResponse(res, null, `Setting ${key} updated successfully`);
  } catch (error) {
    return errorResponse(res, 'Failed to update setting', 500, error);
  }
};
