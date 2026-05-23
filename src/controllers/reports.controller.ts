import { Request, Response } from 'express';
import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, vendor_id, branch_id, salesman_id } = req.query;
    let query = `
      SELECT s.*, 
      IFNULL(v.name_en, s.customer_name) as vendor_name, 
      IFNULL(v.name_ar, s.customer_name) as vendor_name_ar,
      IFNULL(pb.name_en, 'Main') as branch_name,
      IFNULL(pb.name_ar, 'الرئيسي') as branch_name_ar,
      IFNULL(sm.name_en, 'N/A') as salesman_name,
      IFNULL(sm.name_ar, 'N/A') as salesman_name_ar,
      DATE_FORMAT(s.created_at, '%Y-%m-%d') as report_date,
      IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0) as returns_amount,
      IFNULL((
        SELECT SUM(ri.quantity * COALESCE(mi.cost_price, 0)) 
        FROM sales_return_items ri 
        JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
        JOIN sales_returns sr ON ri.return_id = sr.return_id
        WHERE sr.sale_id = s.sale_id
      ), 0) as returns_cost,
      IFNULL((
        SELECT SUM(soi.quantity * COALESCE(mi.cost_price, 0)) 
        FROM sales_order_items soi 
        LEFT JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id 
        WHERE soi.sale_id = s.sale_id
      ), 0) as total_cost
      FROM sales_orders s
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      LEFT JOIN salesmen sm ON s.salesman_id = sm.salesman_id
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
    if (branch_id) {
      query += ` AND s.branch_id = ?`;
      params.push(branch_id);
    }
    if (salesman_id) {
      query += ` AND s.salesman_id = ?`;
      params.push(salesman_id);
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
             DATE_FORMAT(COALESCE(pl.production_date, pl.created_at), '%Y-%m-%d') as report_date,
             pl.expiry_date,
             pi.quantity_produced, 
             COALESCE(mi.name_en, 'Unknown Product') as product_name, 
             COALESCE(mi.name_ar, 'منتج غير مسمى') as product_name_ar,
             COALESCE(mi.price, 0) as price, 
             COALESCE(mi.cost_price, 0) as cost_price
      FROM production_logs pl
      LEFT JOIN production_items pi ON pl.production_id = pi.production_id
      LEFT JOIN menu_items mi ON pi.menu_item_id = mi.menu_item_id
      WHERE pl.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      // Use DATE() to handle both DATE and DATETIME columns correctly
      query += ` AND DATE(COALESCE(pl.production_date, pl.created_at)) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }

    query += ` ORDER BY COALESCE(pl.production_date, pl.created_at) DESC`;

    const [rows]: any = await pool.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error('Production Report Error:', error);
    return errorResponse(res, 'Failed to fetch production report', 500, error);
  }
};

export const getWastageReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, vendor_id, branch_id, salesman_id } = req.query;
    let query = `
      SELECT w.*, 
             DATE_FORMAT(w.created_at, '%Y-%m-%d') as report_date,
             COALESCE(mi.name_en, p.name_en, ii.name_en, 'Unknown Item') as product_name, 
             COALESCE(mi.name_ar, p.name_ar, ii.name_ar, 'منتج غير معروف') as product_name_ar, 
             COALESCE(mi.price, p.base_price, 0) as price, 
             COALESCE(mi.cost_price, ii.cost_price, 0) as cost_price, 
             v.name_en as vendor_name,
             v.name_ar as vendor_name_ar,
             pb.name_en as branch_name,
             pb.name_ar as branch_name_ar
      FROM wastage w
      LEFT JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id
      LEFT JOIN products p ON w.product_id = p.product_id
      LEFT JOIN inventory_items ii ON w.inventory_item_id = ii.inventory_item_id
      LEFT JOIN sales_returns r ON w.return_id = r.return_id
      LEFT JOIN vendors v ON COALESCE(w.vendor_id, r.vendor_id) = v.vendor_id
      LEFT JOIN partner_branches pb ON r.branch_id = pb.branch_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate && endDate) {
      query += ` AND DATE(w.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    if (vendor_id) {
      query += ` AND COALESCE(w.vendor_id, r.vendor_id) = ?`;
      params.push(vendor_id);
    }
    if (branch_id) {
      query += ` AND r.branch_id = ?`;
      params.push(branch_id);
    }
    if (salesman_id) {
      query += ` AND COALESCE(w.salesman_id, r.salesman_id) = ?`;
      params.push(salesman_id);
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
    const { startDate, endDate, vendor_id, branch_id, salesman_id } = req.query;
    const params: any[] = [];
    let dateFilter = "";
    if (startDate && endDate) {
      dateFilter = " AND DATE(s.created_at) BETWEEN ? AND ?";
      params.push(startDate, endDate);
    }
    const vendorFilter = vendor_id ? " AND s.vendor_id = ?" : "";
    if (vendor_id) params.push(vendor_id);

    const branchFilter = branch_id ? " AND s.branch_id = ?" : "";
    if (branch_id) params.push(branch_id);

    const salesmanFilter = salesman_id ? " AND s.salesman_id = ?" : "";
    if (salesman_id) params.push(salesman_id);

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
        ) - IFNULL((
          SELECT SUM(ri.quantity * COALESCE(mi.cost_price, 0)) 
          FROM sales_return_items ri 
          JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
          JOIN sales_returns sr ON ri.return_id = sr.return_id
          WHERE sr.sale_id = s.sale_id
        ), 0)) as profit
      FROM sales_orders s
      WHERE s.deleted_at IS NULL ${dateFilter} ${vendorFilter} ${branchFilter} ${salesmanFilter}
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
      WHERE s.deleted_at IS NULL ${dateFilter} ${vendorFilter} ${branchFilter} ${salesmanFilter}
      GROUP BY name
      ORDER BY revenue DESC
      LIMIT 5
    `;

    // 3. Wastage Distribution — uses same date range
    const wastageParams: any[] = [];
    let wastageDateFilter = "";
    if (startDate && endDate) {
      wastageDateFilter = " AND DATE(w.created_at) BETWEEN ? AND ?";
      wastageParams.push(startDate, endDate);
    }
    let wastageVendorFilter = "";
    if (vendor_id) {
      wastageVendorFilter += " AND COALESCE(w.vendor_id, r.vendor_id) = ?";
      wastageParams.push(vendor_id);
    }
    if (branch_id) {
      wastageVendorFilter += " AND r.branch_id = ?";
      wastageParams.push(branch_id);
    }
    if (salesman_id) {
      wastageVendorFilter += " AND COALESCE(w.salesman_id, r.salesman_id) = ?";
      wastageParams.push(salesman_id);
    }

    const wastageQuery = `
      SELECT w.reason_en as name, COUNT(*) as count
      FROM wastage w
      LEFT JOIN sales_returns r ON w.return_id = r.return_id
      WHERE 1=1 ${wastageDateFilter} ${wastageVendorFilter}
      GROUP BY w.reason_en
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
      query += ` AND DATE(po.date) BETWEEN ? AND ?`;
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
    const { startDate, endDate, vendor_id, branch_id, salesman_id } = req.query;
    
    // Build filter fragments for the subqueries and outer query
    const subDateFilter = (startDate && endDate) ? 'AND DATE(sr.created_at) BETWEEN ? AND ?' : '';
    const subVendorFilter = vendor_id ? 'AND sr.vendor_id = ?' : '';
    const subBranchFilter = branch_id ? 'AND sr.branch_id = ?' : '';
    const subSalesmanFilter = salesman_id ? 'AND sr.salesman_id = ?' : '';

    // 🛡️ SALES-CENTRIC PERFORMANCE ORACLE
    let query = `
      SELECT 
        mi.menu_item_id,
        COALESCE(mi.name_en, 'Unnamed Product') as name_en,
        COALESCE(mi.name_ar, 'منتج غير مسمى') as name_ar,
        COALESCE(c.name_en, 'General') as category,
        SUM(soi.quantity) AS total_sold,
        SUM(soi.quantity * soi.price) AS revenue,
        SUM(soi.quantity * mi.cost_price) AS total_cost,
        COALESCE(
          (SELECT SUM(sri.quantity * sri.unit_price) 
           FROM sales_returns sr 
           JOIN sales_return_items sri ON sr.return_id = sri.return_id
           WHERE sri.menu_item_id = mi.menu_item_id
           ${subDateFilter}
           ${subVendorFilter}
           ${subBranchFilter}
           ${subSalesmanFilter}
          ), 0
        ) as returns_loss,
        COALESCE(
          (SELECT SUM(sri.quantity) 
           FROM sales_returns sr 
           JOIN sales_return_items sri ON sr.return_id = sri.return_id
           WHERE sri.menu_item_id = mi.menu_item_id
           ${subDateFilter}
           ${subVendorFilter}
           ${subBranchFilter}
           ${subSalesmanFilter}
          ), 0
        ) as returns_qty
      FROM sales_order_items soi
      JOIN sales_orders s ON soi.sale_id = s.sale_id AND s.deleted_at IS NULL
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      LEFT JOIN categories c ON mi.category_id = c.category_id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    // Push params for subquery 1 (returns_loss)
    if (startDate && endDate) params.push(startDate, endDate);
    if (vendor_id) params.push(vendor_id);
    if (branch_id) params.push(branch_id);
    if (salesman_id) params.push(salesman_id);

    // Push params for subquery 2 (returns_qty)
    if (startDate && endDate) params.push(startDate, endDate);
    if (vendor_id) params.push(vendor_id);
    if (branch_id) params.push(branch_id);
    if (salesman_id) params.push(salesman_id);

    // Outer query filters
    if (startDate && endDate) {
      query += ` AND DATE(s.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    if (vendor_id) { query += ` AND s.vendor_id = ?`; params.push(vendor_id); }
    if (branch_id) { query += ` AND s.branch_id = ?`; params.push(branch_id); }
    if (salesman_id) { query += ` AND s.salesman_id = ?`; params.push(salesman_id); }

    query += ` GROUP BY mi.menu_item_id ORDER BY total_sold DESC`;

    const [rows]: any = await pool.execute(query, params);

    // 🚀 WOW ENRICHMENT
    const totalRevenue = rows.reduce((acc: number, r: any) => acc + Number(r.revenue), 0);
    const enrichedRows = rows.map((r: any) => ({
      ...r,
      net_profit: (Number(r.revenue) - Number(r.total_cost) - Number(r.returns_loss)).toFixed(3),
      contribution: totalRevenue > 0 ? ((Number(r.revenue) / totalRevenue) * 100).toFixed(1) : 0,
      return_rate: r.total_sold > 0 ? ((Number(r.returns_qty) / Number(r.total_sold)) * 100).toFixed(1) : 0
    }));

    return successResponse(res, enrichedRows);
  } catch (error) {
    console.error('Product Performance Sales-Centric Error:', error);
    return errorResponse(res, 'Failed to fetch product performance report', 500, error);
  }
};
