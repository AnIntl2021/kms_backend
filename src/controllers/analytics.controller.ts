import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const getStoreForecasting = async (req: Request, res: Response) => {
  try {
    // 1. Get Sales vs Wastage with Price/Financial Data
    const [stats]: any = await pool.execute(`
      SELECT 
        v.vendor_id, 
        v.name_en as vendor_name, 
        SUM(CASE WHEN so.dispatch_status IN ('delivered', 'dispatched', 'in_transit', 'paid') THEN so.final_amount ELSE 0 END) as sales_performance,
        (
          SELECT SUM(w.quantity) 
          FROM wastage w 
          LEFT JOIN sales_returns r ON w.return_id = r.return_id
          WHERE (w.vendor_id = v.vendor_id OR r.vendor_id = v.vendor_id)
          AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_wastage_units,
        (
          SELECT SUM(w.quantity * COALESCE(mi.cost_price, 0)) 
          FROM wastage w 
          JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id
          LEFT JOIN sales_returns r ON w.return_id = r.return_id
          WHERE (w.vendor_id = v.vendor_id OR r.vendor_id = v.vendor_id)
          AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_loss_kwd,
        (
          SELECT SUM(so_inner.final_amount) 
          FROM sales_orders so_inner 
          WHERE so_inner.vendor_id = v.vendor_id 
          AND so_inner.dispatch_status IN ('delivered', 'dispatched', 'in_transit')
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
        // 🛡️ FINANCIAL ACCURACY: Calculate loss based on COST PRICE, not Selling Price
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
            recent_sales: salesKwd,
            recent_wastage_units: wasteUnits,
            recent_loss_kwd: lossKwd,
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
        (SELECT SUM(quantity_produced) FROM production_items) as total_produced,
        (SELECT SUM(quantity) FROM wastage WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as total_wasted,
        
        -- 🩺 LOSS BY COST: Actual manufacturing cost lost to wastage
        (SELECT SUM(w.quantity * COALESCE(mi.cost_price, 0)) 
         FROM wastage w 
         JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id 
         WHERE w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as total_loss_kwd,
         
        (SELECT SUM(final_amount) FROM sales_orders WHERE dispatch_status IN ('delivered', 'dispatched', 'in_transit', 'paid') AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND deleted_at IS NULL) as total_revenue_7d,
        
        -- 🩺 LOSS BY COST: Actual manufacturing cost lost to returns
        (SELECT IFNULL(SUM(ri.quantity * COALESCE(mi.cost_price, 0)), 0) 
         FROM sales_return_items ri 
         JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
         JOIN sales_returns r ON ri.return_id = r.return_id
         WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND r.deleted_at IS NULL) as total_returns_7d,
         
        (
          SELECT IFNULL(SUM(soi.quantity * COALESCE(mi.cost_price, 0)), 0)
          FROM sales_order_items soi
          JOIN sales_orders so ON soi.sale_id = so.sale_id
          LEFT JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
          WHERE so.dispatch_status IN ('delivered', 'dispatched', 'in_transit', 'paid') 
          AND so.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND so.deleted_at IS NULL
        ) as total_production_cost_7d
    `);

    const data = hp[0];
    // Profit = Revenue - (Cost of Goods Sold) - (Cost of Goods Wasted/Returned)
    const total_profit_7d = (parseFloat(data.total_revenue_7d || '0') - parseFloat(data.total_production_cost_7d || '0') - parseFloat(data.total_returns_7d || '0'));

    return successResponse(res, {
      ...data,
      total_profit_7d
    });
  } catch (error) {
    console.error('Health Error:', error);
    return errorResponse(res, 'Failed to fetch production health', 500, error);
  }
};
