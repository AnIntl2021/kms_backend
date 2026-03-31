import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const getStoreForecasting = async (req: Request, res: Response) => {
  try {
    // 1. Get Sales vs Wastage with Price/Financial Data
    const [stats]: any = await pool.execute(`
      SELECT 
        v.vendor_id, 
        v.name as vendor_name, 
        SUM(CASE WHEN so.status = 'delivered' THEN so.total_amount ELSE 0 END) as sales_performance,
        (
          SELECT SUM(w.quantity) 
          FROM wastage w 
          WHERE w.vendor_id = v.vendor_id 
          AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_wastage_units,
        (
          SELECT SUM(w.quantity * mi.price) 
          FROM wastage w 
          JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id
          WHERE w.vendor_id = v.vendor_id 
          AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_loss_kwd,
        (
          SELECT SUM(so_inner.total_amount) 
          FROM sales_orders so_inner 
          WHERE so_inner.vendor_id = v.vendor_id 
          AND so_inner.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_sales
      FROM vendors v
      LEFT JOIN sales_orders so ON v.vendor_id = so.vendor_id
      WHERE v.deleted_at IS NULL
      GROUP BY v.vendor_id
    `);

    // 2. Generate forecasting logic with Financial Intelligence
    const forecasting = stats.map((store: any) => {
        const wasteUnits = parseFloat(store.recent_wastage_units || '0');
        const salesKwd = parseFloat(store.recent_sales || '0');
        const lossKwd = parseFloat(store.recent_loss_kwd || '0');
        
        let recommendation = 'STABLE';
        let actionColor = 'emerald';
        let adjustment = 0;
        let priority = 'Low';

        if (lossKwd > 10 || wasteUnits > (salesKwd * 0.2)) { // high financial leak
            recommendation = 'REDUCE PRODUCTION';
            actionColor = 'rose';
            adjustment = -20;
            priority = 'Critical';
        } else if (wasteUnits < 5 && salesKwd > 50) { // high profit opportunity
            recommendation = 'EXPAND INVENTORY';
            actionColor = 'amber';
            adjustment = +25;
            priority = 'High Profit';
        }

        return {
            ...store,
            loss_kwd: lossKwd,
            recommendation,
            actionColor,
            adjustmentScore: adjustment,
            priority
        };
    });

    return successResponse(res, { forecasting });
  } catch (error) {
    console.error('Forecasting Error:', error);
    return errorResponse(res, 'Failed to generate financial analytics', 500, error);
  }
};

export const getProductionHealth = async (req: Request, res: Response) => {
  try {
    const [hp]: any = await pool.execute(`
      SELECT 
        (SELECT SUM(quantity_produced) FROM production_items pi JOIN production_logs pl ON pi.production_id = pl.production_id WHERE pl.production_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as total_produced,
        (SELECT SUM(quantity) FROM wastage WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as total_wasted,
        (SELECT SUM(w.quantity * mi.price) FROM wastage w JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id WHERE w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as total_loss_kwd,
        (SELECT SUM(total_amount) FROM sales_orders WHERE status = 'delivered' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as total_revenue_7d
    `);

    return successResponse(res, hp[0]);
  } catch (error) {
     return errorResponse(res, 'Failed to fetch production health', 500, error);
  }
};
