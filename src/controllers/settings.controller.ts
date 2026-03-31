import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const getSettings = async (req: Request, res: Response) => {
  try {
    const [settings] = await pool.execute('SELECT * FROM system_settings');
    // Map to a more useful object
    const settingsObj = (settings as any[]).reduce((acc, curr) => {
      acc[curr.setting_key] = curr.setting_value;
      return acc;
    }, {});
    
    return successResponse(res, settingsObj);
  } catch (error) {
    console.error('GetSettings Error:', error);
    return errorResponse(res, 'Failed to fetch settings', 500, error);
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const settings = req.body; // Expecting { key: value, ... }
    
    const queries = Object.keys(settings).map(key => {
      return pool.execute(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, settings[key], settings[key]]
      );
    });
    
    await Promise.all(queries);
    
    return successResponse(res, null, 'Settings updated successfully');
  } catch (error) {
    console.error('UpdateSettings Error:', error);
    return errorResponse(res, 'Failed to update settings', 500, error);
  }
};
