import { Request, Response } from 'express';
import pool from '../config/db';

export const getSalesmen = async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM salesmen WHERE deleted_at IS NULL ORDER BY name_en ASC');
        res.json({ success: true, data: rows });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSalesmanById = async (req: Request, res: Response) => {
    try {
        const [rows]: any = await pool.execute('SELECT * FROM salesmen WHERE salesman_id = ? AND deleted_at IS NULL', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Salesman not found' });
        res.json({ success: true, data: rows[0] });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createSalesman = async (req: Request, res: Response) => {
    const { name_en, name_ar, phone, email, commission_rate } = req.body;
    try {
        const [result]: any = await pool.execute(
            'INSERT INTO salesmen (name_en, name_ar, phone, email, commission_rate) VALUES (?, ?, ?, ?, ?)',
            [name_en, name_ar, phone, email, commission_rate || 0]
        );
        res.status(201).json({ success: true, data: { salesman_id: result.insertId, ...req.body } });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateSalesman = async (req: Request, res: Response) => {
    const { name_en, name_ar, phone, email, commission_rate, status } = req.body;
    try {
        await pool.execute(
            'UPDATE salesmen SET name_en = ?, name_ar = ?, phone = ?, email = ?, commission_rate = ?, status = ? WHERE salesman_id = ?',
            [name_en, name_ar, phone, email, commission_rate, status, req.params.id]
        );
        res.json({ success: true, message: 'Salesman updated successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteSalesman = async (req: Request, res: Response) => {
    try {
        await pool.execute('UPDATE salesmen SET deleted_at = NOW() WHERE salesman_id = ?', [req.params.id]);
        res.json({ success: true, message: 'Salesman deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSalesmanPerformance = async (req: Request, res: Response) => {
    try {
        const [rows]: any = await pool.execute(`
            SELECT 
                s.salesman_id,
                s.name_en,
                COUNT(so.sale_id) as total_orders,
                SUM(so.total_amount) as total_revenue,
                SUM(so.total_amount * (s.commission_rate / 100)) as estimated_commission
            FROM salesmen s
            LEFT JOIN sales_orders so ON s.salesman_id = so.salesman_id AND so.deleted_at IS NULL
            WHERE s.deleted_at IS NULL
            GROUP BY s.salesman_id
        `);
        res.json({ success: true, data: rows });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
