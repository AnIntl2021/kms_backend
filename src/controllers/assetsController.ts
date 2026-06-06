import { Request, Response } from 'express';
import db from '../config/db';

export const getAssets = async (req: Request, res: Response) => {
  try {
    const [rows] = await db.query('SELECT * FROM company_assets ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch assets', error });
  }
};

export const createAsset = async (req: Request, res: Response) => {
  const { name, type, value, depreciation_rate, date_acquired } = req.body;
  try {
    const [result]: any = await db.query(
      'INSERT INTO company_assets (name, type, value, depreciation_rate, date_acquired) VALUES (?, ?, ?, ?, ?)',
      [name, type || 'General', value, depreciation_rate || 0, date_acquired || new Date()]
    );
    res.status(201).json({ success: true, data: { asset_id: result.insertId, name, type, value, depreciation_rate, date_acquired } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create asset', error });
  }
};

export const updateAsset = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, type, value, depreciation_rate, date_acquired } = req.body;
  try {
    await db.query(
      'UPDATE company_assets SET name=?, type=?, value=?, depreciation_rate=?, date_acquired=? WHERE asset_id=?',
      [name, type, value, depreciation_rate, date_acquired, id]
    );
    res.json({ success: true, message: 'Asset updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update asset', error });
  }
};
