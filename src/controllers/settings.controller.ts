import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';
import { runBackup } from '../utils/backup';

import { tenantContext } from '../middleware/tenantContext';

export const getSettings = async (req: Request, res: Response) => {
  try {
    let targetDb = 'kms_master';
    const tenantIdParam = (req.query.tenant as string) || (req.headers['x-tenant-id'] as string);

    if (tenantIdParam) {
      // Find tenant db
      const [tenants]: any = await pool.execute('SELECT db_name FROM tenants WHERE tenant_id = ? OR name = ?', [tenantIdParam, tenantIdParam]);
      if (tenants.length > 0) {
        targetDb = tenants[0].db_name;
      }
    } else {
      const currentDb = tenantContext.getStore()?.dbName;
      if (currentDb) targetDb = currentDb;
    }

    await tenantContext.run({ dbName: targetDb }, async () => {
      const [settings] = await pool.execute('SELECT * FROM system_settings');
      // Map to a more useful object
      const settingsObj = (settings as any[]).reduce((acc, curr) => {
        acc[curr.setting_key] = curr.setting_value;
        return acc;
      }, {});
      
      // If company_name is empty, try to fetch it from the master db tenants table
      let tenantPlan = 'Basic';
      let companyName = '';
      if (targetDb && targetDb !== 'kms_master') {
        await tenantContext.run({ dbName: 'kms_master' }, async () => {
          const [tenantRows]: any = await pool.execute('SELECT plan, name FROM tenants WHERE db_name = ?', [targetDb]);
          if (tenantRows && tenantRows.length > 0) {
            tenantPlan = tenantRows[0].plan;
            companyName = tenantRows[0].name;
          }
        });
        
        if (companyName) {
          settingsObj.company_name = companyName;
          await pool.execute(
            'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            ['company_name', companyName, companyName]
          );
          if (!settingsObj.receipt_header) {
            settingsObj.receipt_header = companyName;
            await pool.execute(
              'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
              ['receipt_header', companyName, companyName]
            );
          }
        }
      }
      
      if (!settingsObj.receipt_footer) {
        settingsObj.receipt_footer = "Thank you for your visit!\nPlease come again.";
        await pool.execute(
          'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
          ['receipt_footer', settingsObj.receipt_footer, settingsObj.receipt_footer]
        );
      }
      settingsObj.subscription_plan = tenantPlan;

      return successResponse(res, settingsObj);
    });
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

export const triggerBackup = async (req: Request, res: Response) => {
  const result = await runBackup();
  if (result.success) {
    return successResponse(res, { file: result.file }, 'Backup created and rotated successfully');
  } else {
    return errorResponse(res, 'Backup failed', 500, result.error);
  }
};
