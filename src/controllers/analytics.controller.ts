import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const getStoreForecasting = async (req: Request, res: Response) => {
  try {
    // 1. Get Sales vs Wastage with Price/Financial Data & Sold Units count
    const [stats]: any = await pool.execute(`
      SELECT 
        v.vendor_id, 
        v.name_en as vendor_name, 
        pb.branch_id,
        pb.name_en as branch_name,
        (
          SELECT SUM(w.quantity) 
          FROM wastage w 
          LEFT JOIN sales_returns r ON w.return_id = r.return_id
          WHERE (w.vendor_id = v.vendor_id OR r.vendor_id = v.vendor_id)
          AND (pb.branch_id IS NULL OR r.branch_id = pb.branch_id)
          AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_wastage_units,
        (
          SELECT SUM(w.quantity * COALESCE(mi.cost_price, 0)) 
          FROM wastage w 
          JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id
          LEFT JOIN sales_returns r ON w.return_id = r.return_id
          WHERE (w.vendor_id = v.vendor_id OR r.vendor_id = v.vendor_id)
          AND (pb.branch_id IS NULL OR r.branch_id = pb.branch_id)
          AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_loss_kwd,
        (
          SELECT SUM(so_inner.final_amount) 
          FROM sales_orders so_inner 
          WHERE so_inner.vendor_id = v.vendor_id 
          AND (pb.branch_id IS NULL OR so_inner.branch_id = pb.branch_id)
          AND so_inner.dispatch_status IN ('delivered', 'dispatched', 'in_transit')
          AND so_inner.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_sales,
        (
          SELECT SUM(soi.quantity)
          FROM sales_order_items soi
          JOIN sales_orders s ON soi.sale_id = s.sale_id
          WHERE s.vendor_id = v.vendor_id
          AND (pb.branch_id IS NULL OR s.branch_id = pb.branch_id)
          AND s.dispatch_status IN ('delivered', 'dispatched', 'in_transit')
          AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_sold_units
      FROM vendors v
      LEFT JOIN partner_branches pb ON pb.partner_id = v.vendor_id AND pb.status = 'active'
      WHERE v.deleted_at IS NULL
      GROUP BY v.vendor_id, pb.branch_id
    `);

    // 2. Generate forecasting logic with advanced statistical metrics
    const forecasting = stats.map((store: any) => {
        const wasteUnits = parseFloat(store.recent_wastage_units || '0');
        const salesKwd = parseFloat(store.recent_sales || '0');
        const lossKwd = parseFloat(store.recent_loss_kwd || '0'); 
        const soldUnits = parseFloat(store.recent_sold_units || '0');

        const dailySold = parseFloat((soldUnits / 7).toFixed(1));
        const dailyWasted = parseFloat((wasteUnits / 7).toFixed(1));
        
        // Return rate based on total units routed to the customer
        const totalRouted = soldUnits + wasteUnits;
        const returnRate = totalRouted > 0 ? parseFloat(((wasteUnits / totalRouted) * 100).toFixed(1)) : 0;

        let recommendation = 'STABLE';
        let actionColor = 'emerald';
        let adjustment = 0;
        let priority = 'Low';
        let optimalNextDispatch = Math.round(dailySold);

        if (returnRate > 15 || lossKwd > 15) { // High return leak
            recommendation = 'REDUCE DISPATCH';
            actionColor = 'rose';
            adjustment = -Math.round(returnRate);
            priority = 'Critical';
            optimalNextDispatch = Math.max(0, Math.round(dailySold * 0.75));
        } else if (returnRate < 5 && dailySold > 8) { // High growth/sales opportunity
            recommendation = 'EXPAND SUPPLY';
            actionColor = 'emerald';
            adjustment = 20;
            priority = 'Growth Option';
            optimalNextDispatch = Math.round(dailySold * 1.25);
        } else {
            recommendation = 'MAINTAIN';
            actionColor = 'blue';
            adjustment = 0;
            priority = 'Stable';
            optimalNextDispatch = Math.round(dailySold);
        }

        // Expected cost savings if recommendation is applied
        const expectedSavings = recommendation === 'REDUCE DISPATCH' ? parseFloat((lossKwd * 0.8).toFixed(3)) : 0;

        return {
            ...store,
            recent_sales: salesKwd,
            recent_wastage_units: wasteUnits,
            recent_loss_kwd: lossKwd,
            loss_kwd: lossKwd,
            recent_sold_units: soldUnits,
            sales_velocity: dailySold,
            wastage_velocity: dailyWasted,
            return_rate: returnRate,
            optimal_dispatch: optimalNextDispatch,
            expected_savings: expectedSavings,
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
