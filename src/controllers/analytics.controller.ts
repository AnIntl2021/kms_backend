import { Request, Response } from 'express';
import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

const getReportScope = (req: Request) => {
  const user = (req as any).user;
  
  const userBrandId = user?.brand_id || null;
  const userBranchId = user?.branch_id || null;

  const queryBrandId = req.query.brand_id ? Number(req.query.brand_id) : null;
  const queryBranchId = req.query.branch_id ? Number(req.query.branch_id) : null;

  // Strict Scoping: If user is scoped to a specific branch/brand, they CANNOT bypass it via query parameters.
  return {
    brandId: userBrandId ? userBrandId : queryBrandId,
    branchId: userBranchId ? userBranchId : queryBranchId
  };
};

export const getStoreForecasting = async (req: Request, res: Response) => {
  try {
    const { brandId, branchId } = getReportScope(req);
    // Determine business type from settings
    const [settingsRows]: any = await pool.execute(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'business_type'"
    );
    const businessType = (settingsRows && settingsRows.length > 0) ? settingsRows[0].setting_value : 'restaurant_pos';

    if (businessType === 'restaurant_pos') {
      // 1. Get menu items sold in the last 14 days to compute velocity
      let salesQuery = `
        SELECT 
          mi.menu_item_id,
          mi.name_en AS menu_item_name,
          mi.name_ar AS menu_item_name_ar,
          mi.price,
          mi.cost_price,
          SUM(soi.quantity) AS units_sold,
          SUM(soi.quantity) / 14.0 AS daily_velocity
        FROM sales_order_items soi
        JOIN sales_orders s ON soi.sale_id = s.sale_id
        JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
        WHERE s.deleted_at IS NULL AND s.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      `;
      const salesParams: any[] = [];
      if (branchId) {
        salesQuery += ` AND s.branch_id = ?`;
        salesParams.push(branchId);
      }
      if (brandId) {
        salesQuery += ` AND s.brand_id = ?`;
        salesParams.push(brandId);
      }
      salesQuery += ` GROUP BY mi.menu_item_id ORDER BY units_sold DESC`;

      const [menuSales]: any = await pool.execute(salesQuery, salesParams);

      let menuItems = menuSales;
      if (menuItems.length === 0) {
        // Fallback: Fetch some default menu items if there are no recent sales
        let fallbackQuery = `
          SELECT menu_item_id, name_en AS menu_item_name, name_ar AS menu_item_name_ar, price, cost_price, 0 AS units_sold, 0.0 AS daily_velocity
          FROM menu_items
          WHERE deleted_at IS NULL
        `;
        const fallbackParams: any[] = [];
        if (brandId) {
          fallbackQuery += ` AND brand_id = ?`;
          fallbackParams.push(brandId);
        }
        fallbackQuery += ` LIMIT 10`;
        const [allMenu]: any = await pool.execute(fallbackQuery, fallbackParams);
        menuItems = allMenu;
      }

      if (menuItems.length === 0) {
        return successResponse(res, { forecasting: [] });
      }

      const menuItemIds = menuItems.map((m: any) => m.menu_item_id).join(',');
      
      // 2. Fetch recipe ingredients mapped to these menu items
      let ingQuery = `
        SELECT 
          mii.menu_item_id,
          ii.inventory_item_id,
          ii.name_en,
          ii.name_ar,
          ii.current_stock,
          ii.cost_price,
          ii.unit_en,
          ii.unit_ar,
          mii.quantity AS qty_per_unit,
          COALESCE(iip.multiplier, 1.0) as multiplier
        FROM menu_item_ingredients mii
        JOIN inventory_items ii ON mii.inventory_item_id = ii.inventory_item_id
        LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
        WHERE mii.menu_item_id IN (${menuItemIds}) AND ii.deleted_at IS NULL
      `;
      const ingParams: any[] = [];
      if (brandId) {
        ingQuery += ` AND ii.brand_id = ?`;
        ingParams.push(brandId);
      }
      const [ingredients]: any = await pool.execute(ingQuery, ingParams);

      // 3. Fallback: If no ingredients mapped, return menu items directly
      if (ingredients.length === 0) {
        const forecasting = menuItems.map((m: any) => {
          const velocity = parseFloat(m.daily_velocity || '0') * 7;
          return {
            vendor_id: m.menu_item_id,
            vendor_name: m.menu_item_name,
            vendor_name_ar: m.menu_item_name_ar,
            branch_id: null,
            branch_name: 'Menu Item',
            recent_wastage_units: 0,
            recent_loss_kwd: 0,
            recent_sales: parseFloat(m.price) * parseFloat(m.units_sold),
            recent_sold_units: parseFloat(m.units_sold),
            sales_velocity: parseFloat(velocity.toFixed(2)),
            wastage_velocity: 0,
            return_rate: 100,
            optimal_dispatch: Math.ceil(velocity * 1.1),
            expected_savings: 0,
            recommendation: m.units_sold > 0 ? 'MAINTAIN' : 'UNDERPERFORMING',
            actionColor: m.units_sold > 0 ? 'emerald' : 'rose',
            adjustmentScore: 0,
            priority: m.units_sold > 0 ? 'Stable' : 'Critical'
          };
        });
        return successResponse(res, { forecasting });
      }

      // 4. Calculate predicted weekly demand grouped by ingredient
      const ingredientMap = new Map<number, any>();
      ingredients.forEach((ing: any) => {
        const menuItem = menuItems.find((m: any) => m.menu_item_id === ing.menu_item_id);
        const velocity = menuItem ? parseFloat(menuItem.daily_velocity || '0') : 0.1; // Default minimum velocity for prediction fallback
        const weeklyDemand = velocity * 7 * parseFloat(ing.qty_per_unit) * parseFloat(ing.multiplier);
        
        if (!ingredientMap.has(ing.inventory_item_id)) {
          ingredientMap.set(ing.inventory_item_id, {
            inventory_item_id: ing.inventory_item_id,
            name_en: ing.name_en,
            name_ar: ing.name_ar,
            current_stock: parseFloat(ing.current_stock || '0'),
            cost_price: parseFloat(ing.cost_price || '0'),
            unit_en: ing.unit_en,
            unit_ar: ing.unit_ar,
            weekly_demand: 0
          });
        }
        
        const cached = ingredientMap.get(ing.inventory_item_id);
        cached.weekly_demand += weeklyDemand;
      });

      // 5. Build premium forecasting payload
      const forecasting = Array.from(ingredientMap.values()).map((ing: any) => {
        const weeklyDemand = parseFloat(ing.weekly_demand.toFixed(2));
        const currentStock = ing.current_stock;
        const deficit = Math.max(0, weeklyDemand - currentStock);
        const reorderCost = deficit * ing.cost_price;
        
        // Stock Coverage percentage (how much of weekly demand is currently stocked)
        const returnRate = weeklyDemand > 0 ? Math.round(Math.min(100, (currentStock / weeklyDemand) * 100)) : 100;
        
        let priority = 'Stable';
        let recommendation = 'IN STOCK';
        let actionColor = 'emerald';
        let optimalDispatch = weeklyDemand; 

        if (deficit > 0) {
          recommendation = 'REORDER';
          actionColor = 'rose';
          optimalDispatch = Math.ceil(weeklyDemand * 1.2); // Recommend 20% buffer
          priority = (currentStock < weeklyDemand * 0.25) ? 'Critical' : 'Medium';
        } else if (currentStock > weeklyDemand * 3 && weeklyDemand > 0) {
          recommendation = 'EXCESS STOCK';
          actionColor = 'amber';
          priority = 'Low';
        }

        return {
          vendor_id: ing.inventory_item_id,
          vendor_name: ing.name_en,
          vendor_name_ar: ing.name_ar,
          branch_id: null,
          branch_name: `${currentStock} ${ing.unit_en} in stock`,
          recent_wastage_units: 0,
          recent_loss_kwd: 0,
          recent_sales: 0,
          recent_sold_units: 0,
          sales_velocity: weeklyDemand,
          wastage_velocity: 0,
          return_rate: returnRate, // Stock coverage %
          optimal_dispatch: optimalDispatch,
          expected_savings: reorderCost, // Deficiency cost / restocking cost
          recommendation,
          actionColor,
          adjustmentScore: deficit > 0 ? Math.round((deficit / weeklyDemand) * 100) : 0,
          priority
        };
      });

      return successResponse(res, { forecasting });
    } else {
      // ----------------------------------------------------
      // ORIGINAL B2B LOGIC
      // ----------------------------------------------------
      let statsQuery = `
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
      `;
      const statsParams: any[] = [];
      if (branchId) {
        statsQuery += ` AND pb.branch_id = ?`;
        statsParams.push(branchId);
      }
      if (brandId) {
        statsQuery += ` AND v.brand_id = ?`;
        statsParams.push(brandId);
      }
      statsQuery += ` GROUP BY v.vendor_id, pb.branch_id`;
      const [stats]: any = await pool.execute(statsQuery, statsParams);

      const forecasting = stats.map((store: any) => {
          const wasteUnits = parseFloat(store.recent_wastage_units || '0');
          const salesKwd = parseFloat(store.recent_sales || '0');
          const lossKwd = parseFloat(store.recent_loss_kwd || '0'); 
          const soldUnits = parseFloat(store.recent_sold_units || '0');

          const dailySold = parseFloat((soldUnits / 7).toFixed(1));
          const dailyWasted = parseFloat((wasteUnits / 7).toFixed(1));
          
          const totalRouted = soldUnits + wasteUnits;
          const returnRate = totalRouted > 0 ? parseFloat(((wasteUnits / totalRouted) * 100).toFixed(1)) : 0;

          let recommendation = 'STABLE';
          let actionColor = 'emerald';
          let adjustment = 0;
          let priority = 'Low';
          let optimalNextDispatch = Math.round(dailySold);

          if (returnRate > 15 || lossKwd > 15) {
              recommendation = 'REDUCE DISPATCH';
              actionColor = 'rose';
              adjustment = -Math.round(returnRate);
              priority = 'Critical';
              optimalNextDispatch = Math.max(0, Math.round(dailySold * 0.75));
          } else if (returnRate < 5 && dailySold > 8) {
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
    }
  } catch (error) {
    console.error('Forecasting Error:', error);
    return errorResponse(res, 'Failed to generate financial analytics', 500, error);
  }
};

export const getProductionHealth = async (req: Request, res: Response) => {
  try {
    const { brandId, branchId } = getReportScope(req);
    // Determine business type from settings
    const [settingsRows]: any = await pool.execute(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'business_type'"
    );
    const businessType = (settingsRows && settingsRows.length > 0) ? settingsRows[0].setting_value : 'restaurant_pos';

    let revenueQuery = `
      SELECT SUM(final_amount) 
      FROM sales_orders 
      WHERE dispatch_status IN ('delivered', 'dispatched', 'in_transit', 'paid') 
      AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
      AND deleted_at IS NULL
    `;
    let productionCostQuery = `
      SELECT IFNULL(SUM(soi.quantity * COALESCE(mi.cost_price, 0)), 0)
      FROM sales_order_items soi
      JOIN sales_orders so ON soi.sale_id = so.sale_id
      LEFT JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      WHERE so.dispatch_status IN ('delivered', 'dispatched', 'in_transit', 'paid') 
      AND so.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND so.deleted_at IS NULL
    `;

    if (businessType === 'restaurant_pos') {
      // For POS, count all non-cancelled completed or paid sales orders
      revenueQuery = `
        SELECT SUM(final_amount) 
        FROM sales_orders 
        WHERE status = 'completed'
        AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
        AND deleted_at IS NULL
      `;
      productionCostQuery = `
        SELECT IFNULL(SUM(soi.quantity * COALESCE(mi.cost_price, 0)), 0)
        FROM sales_order_items soi
        JOIN sales_orders so ON soi.sale_id = so.sale_id
        LEFT JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
        WHERE so.status = 'completed'
        AND so.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND so.deleted_at IS NULL
      `;
    }

    if (branchId) {
      revenueQuery += ` AND branch_id = ${Number(branchId)}`;
      productionCostQuery += ` AND so.branch_id = ${Number(branchId)}`;
    }
    if (brandId) {
      revenueQuery += ` AND brand_id = ${Number(brandId)}`;
      productionCostQuery += ` AND so.brand_id = ${Number(brandId)}`;
    }

    let prodQuery = `SELECT SUM(pi.quantity_produced) FROM production_items pi JOIN production_logs pl ON pi.production_id = pl.production_id WHERE pl.deleted_at IS NULL`;
    let wasteQuery = `SELECT SUM(w.quantity) FROM wastage w LEFT JOIN admins a ON w.admin_id = a.id WHERE w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND w.deleted_at IS NULL`;
    let wasteLossQuery = `SELECT SUM(w.quantity * COALESCE(mi.cost_price, 0)) FROM wastage w JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id LEFT JOIN admins a ON w.admin_id = a.id WHERE w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND w.deleted_at IS NULL`;
    let returnsQuery = `
      SELECT IFNULL(SUM(ri.quantity * COALESCE(mi.cost_price, 0)), 0) 
      FROM sales_return_items ri 
      JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
      JOIN sales_returns r ON ri.return_id = r.return_id
      WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND r.deleted_at IS NULL
    `;

    if (branchId) {
      prodQuery += ` AND pl.branch_id = ${Number(branchId)}`;
      wasteQuery += ` AND (w.branch_id = ${Number(branchId)} OR a.branch_id = ${Number(branchId)})`;
      wasteLossQuery += ` AND (w.branch_id = ${Number(branchId)} OR a.branch_id = ${Number(branchId)})`;
      returnsQuery += ` AND r.branch_id = ${Number(branchId)}`;
    }
    if (brandId) {
      prodQuery += ` AND pl.brand_id = ${Number(brandId)}`;
      wasteQuery += ` AND (w.brand_id = ${Number(brandId)} OR a.brand_id = ${Number(brandId)})`;
      wasteLossQuery += ` AND (w.brand_id = ${Number(brandId)} OR a.brand_id = ${Number(brandId)})`;
      returnsQuery += ` AND r.brand_id = ${Number(brandId)}`;
    }

    const [hp]: any = await pool.execute(`
      SELECT 
        (${prodQuery}) as total_produced,
        (${wasteQuery}) as total_wasted,
        
        -- LOSS BY COST: Actual manufacturing cost lost to wastage
        (${wasteLossQuery}) as total_loss_kwd,
         
        (${revenueQuery}) as total_revenue_7d,
        
        -- LOSS BY COST: Actual manufacturing cost lost to returns
        (${returnsQuery}) as total_returns_7d,
         
        (${productionCostQuery}) as total_production_cost_7d
    `);

    const data = hp[0];
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
