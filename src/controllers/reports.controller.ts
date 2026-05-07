import { Request, Response } from 'express';
import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, vendor_id } = req.query;
    let query = `
      SELECT s.*, 
      IFNULL(v.name_en, s.customer_name) as vendor_name, 
      b.name_en as branch_name,
      DATE_FORMAT(s.created_at, '%Y-%m-%d') as report_date,
      IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0) as returns_amount,
      IFNULL((
        SELECT SUM(soi.quantity * COALESCE(mi.cost_price, 0)) 
        FROM sales_order_items soi 
        LEFT JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id 
        WHERE soi.sale_id = s.sale_id
      ), 0) as total_cost
      FROM sales_orders s
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN branches b ON s.branch_id = b.branch_id
      WHERE s.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      query += ` AND DATE(s.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    if (vendor_id) {
      query += ` AND s.vendor_id = ?`;
      params.push(vendor_id);
    }

    query += ` ORDER BY s.created_at DESC`;

    const [rows]: any = await pool.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error('Sales Report Error:', error);
    return errorResponse(res, 'Failed to fetch sales report', 500, error);
  }
};

export const getProductionReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT pl.production_id, pl.batch_number, 
             DATE_FORMAT(pl.production_date, '%Y-%m-%d') as report_date,
             pl.expiry_date,
             pi.quantity_produced, 
             COALESCE(mi.name_en, 'Unknown Product') as product_name, 
             COALESCE(mi.price, 0) as price, 
             COALESCE(mi.cost_price, 0) as cost_price
      FROM production_logs pl
      LEFT JOIN production_items pi ON pl.production_id = pi.production_id
      LEFT JOIN menu_items mi ON pi.menu_item_id = mi.menu_item_id
      WHERE pl.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      query += ` AND pl.production_date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY pl.production_date DESC`;

    const [rows]: any = await pool.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error('Production Report Error:', error);
    return errorResponse(res, 'Failed to fetch production report', 500, error);
  }
};

export const getWastageReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT w.*, 
             DATE_FORMAT(w.created_at, '%Y-%m-%d') as report_date,
             COALESCE(mi.name_en, p.name_en, ii.name_en, 'Unknown Item') as product_name, 
             COALESCE(mi.price, p.base_price, 0) as price, 
             COALESCE(mi.cost_price, ii.cost_price, 0) as cost_price, 
             v.name_en as vendor_name
      FROM wastage w
      LEFT JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id
      LEFT JOIN products p ON w.product_id = p.product_id
      LEFT JOIN inventory_items ii ON w.inventory_item_id = ii.inventory_item_id
      LEFT JOIN vendors v ON w.vendor_id = v.vendor_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      query += ` AND DATE(w.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY w.created_at DESC`;

    const [rows]: any = await pool.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error('Wastage Report Error:', error);
    return errorResponse(res, 'Failed to fetch wastage report', 500, error);
  }
};

export const getAnalyticsSummary = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, vendor_id } = req.query;
    const params: any[] = [];
    let dateFilter = "";
    if (startDate && endDate) {
      dateFilter = " AND DATE(s.created_at) BETWEEN ? AND ?";
      params.push(startDate, endDate);
    }
    const vendorFilter = vendor_id ? " AND s.vendor_id = ?" : "";
    if (vendor_id) params.push(vendor_id);

    // 1. Daily Trend
    const dailyQuery = `
      SELECT 
        DATE_FORMAT(s.created_at, '%Y-%m-%d') as date,
        SUM(s.final_amount) as revenue,
        SUM(s.final_amount - (
          SELECT IFNULL(SUM(soi.quantity * COALESCE(mi.cost_price, 0)), 0)
          FROM sales_order_items soi
          LEFT JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
          WHERE soi.sale_id = s.sale_id
        ) - IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0)) as profit
      FROM sales_orders s
      WHERE s.deleted_at IS NULL ${dateFilter} ${vendorFilter}
      GROUP BY date
      ORDER BY date ASC
    `;

    // 2. Top Customers
    const customersQuery = `
      SELECT 
        IFNULL(v.name_en, s.customer_name) as name,
        SUM(s.final_amount) as revenue
      FROM sales_orders s
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      WHERE s.deleted_at IS NULL ${dateFilter} ${vendorFilter}
      GROUP BY name
      ORDER BY revenue DESC
      LIMIT 5
    `;

    // 4. Wastage Distribution
    let wastageDateFilter = "";
    const wastageParams: any[] = [];
    if (startDate && endDate) {
      wastageDateFilter = " AND DATE(w.created_at) BETWEEN ? AND ?";
      wastageParams.push(startDate, endDate);
    }

    const wastageQuery = `
      SELECT reason_en as name, COUNT(*) as count
      FROM wastage w
      WHERE 1=1 ${wastageDateFilter}
      GROUP BY reason_en
    `;

    const [dailyTrend]: any = await pool.execute(dailyQuery, params);
    const [topCustomers]: any = await pool.execute(customersQuery, params);
    const [wastageReasons]: any = await pool.execute(wastageQuery, wastageParams);

    return successResponse(res, {
      dailyTrend,
      topCustomers,
      wastageReasons
    });
  } catch (error) {
    console.error('Analytics Summary Error:', error);
    return errorResponse(res, 'Failed to fetch analytics summary', 500, error);
  }
};

export const getPurchaseReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, vendor_id, branch_id } = req.query;
    let query = `
      SELECT po.*, 
      v.name_en as vendor_name, 
      v.name_ar as vendor_name_ar,
      pb.name_en as branch_name,
      pb.name_ar as branch_name_ar,
      DATE_FORMAT(po.date, '%Y-%m-%d') as report_date
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON po.branch_id = pb.branch_id
      WHERE po.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      query += ` AND po.date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    if (vendor_id) {
      query += ` AND po.vendor_id = ?`;
      params.push(vendor_id);
    }
    if (branch_id) {
      query += ` AND po.branch_id = ?`;
      params.push(branch_id);
    }

    query += ` ORDER BY po.date DESC, po.purchase_id DESC`;

    const [rows]: any = await pool.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error('Purchase Report Error:', error);
    return errorResponse(res, 'Failed to fetch purchase report', 500, error);
  }
};

export const getProductPerformanceReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT 
        mi.menu_item_id,
        mi.name_en as product_name,
        mi.name_ar as product_name_ar,
        mi.category,
        COALESCE(SUM(soi.quantity), 0) as total_quantity,
        COALESCE(SUM(soi.quantity * soi.price), 0) as total_revenue,
        COALESCE(SUM(soi.quantity * COALESCE(mi.cost_price, 0)), 0) as total_cost,
        COALESCE((SUM(soi.quantity * soi.price) - SUM(soi.quantity * COALESCE(mi.cost_price, 0))), 0) as total_profit
      FROM sales_order_items soi
      JOIN sales_orders s ON soi.sale_id = s.sale_id
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      WHERE s.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      query += ` AND DATE(s.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` GROUP BY mi.menu_item_id ORDER BY total_quantity DESC`;

    const [rows]: any = await pool.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error('Product Performance Report Error:', error);
    return errorResponse(res, 'Failed to fetch product performance report', 500, error);
  }
};
