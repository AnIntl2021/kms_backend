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

export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, vendor_id, salesman_id } = req.query;
    const { brandId, branchId } = getReportScope(req);
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
      LEFT JOIN branches pb ON s.branch_id = pb.branch_id
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
    if (branchId) {
      query += ` AND s.branch_id = ?`;
      params.push(branchId);
    }
    if (brandId) {
      query += ` AND s.brand_id = ?`;
      params.push(brandId);
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
    const { startDate, endDate, vendor_id, salesman_id } = req.query;
    const { brandId, branchId } = getReportScope(req);
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
      LEFT JOIN admins a ON w.admin_id = a.admin_id
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
    if (branchId) {
      query += ` AND (r.branch_id = ? OR w.branch_id = ? OR a.branch_id = ?)`;
      params.push(branchId, branchId, branchId);
    }
    if (brandId) {
      query += ` AND (mi.brand_id = ? OR ii.brand_id = ? OR a.brand_id = ?)`;
      params.push(brandId, brandId, brandId);
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
    const { startDate, endDate, vendor_id, salesman_id } = req.query;
    const { brandId, branchId } = getReportScope(req);
    const params: any[] = [];
    let dateFilter = "";
    if (startDate && endDate) {
      dateFilter = " AND DATE(s.created_at) BETWEEN ? AND ?";
      params.push(startDate, endDate);
    }
    const vendorFilter = vendor_id ? " AND s.vendor_id = ?" : "";
    if (vendor_id) params.push(vendor_id);

    const branchFilter = branchId ? " AND s.branch_id = ?" : "";
    if (branchId) params.push(branchId);

    const brandFilter = brandId ? " AND s.brand_id = ?" : "";
    if (brandId) params.push(brandId);

    const salesmanFilter = salesman_id ? " AND s.salesman_id = ?" : "";
    if (salesman_id) params.push(salesman_id);

    // Helper for dailyQuery/customersQuery parameter matching
    const queryParams = [...params];

    // 1. Daily Trend
    const dailyQuery = `
      SELECT 
        DATE_FORMAT(s.created_at, '%Y-%m-%d') as date,
        SUM(s.total_amount) as revenue,
        SUM(s.total_amount - (
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
      WHERE s.deleted_at IS NULL ${dateFilter} ${vendorFilter} ${branchFilter} ${brandFilter} ${salesmanFilter}
      GROUP BY date
      ORDER BY date ASC
    `;

    // 2. Top Customers
    const customersQuery = `
      SELECT 
        IFNULL(v.name_en, s.customer_name) as name,
        SUM(s.total_amount) as revenue
      FROM sales_orders s
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      WHERE s.deleted_at IS NULL ${dateFilter} ${vendorFilter} ${branchFilter} ${brandFilter} ${salesmanFilter}
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
    if (branchId) {
      wastageVendorFilter += " AND (r.branch_id = ? OR w.branch_id = ?)";
      wastageParams.push(branchId, branchId);
    }
    if (brandId) {
      wastageVendorFilter += " AND (w.brand_id = ? OR r.brand_id = ?)";
      wastageParams.push(brandId, brandId);
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

    const [dailyTrend]: any = await pool.execute(dailyQuery, queryParams);
    const [topCustomers]: any = await pool.execute(customersQuery, queryParams);
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
    const { startDate, endDate, vendor_id } = req.query;
    const { brandId, branchId } = getReportScope(req);
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
    if (branchId) {
      query += ` AND po.branch_id = ?`;
      params.push(branchId);
    }
    if (brandId) {
      query += ` AND po.brand_id = ?`;
      params.push(brandId);
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
    const { startDate, endDate, vendor_id, salesman_id } = req.query;
    const { brandId, branchId } = getReportScope(req);
    
    // Build filter fragments for the subqueries and outer query
    const subDateFilter = (startDate && endDate) ? 'AND DATE(sr.created_at) BETWEEN ? AND ?' : '';
    const subVendorFilter = vendor_id ? 'AND sr.vendor_id = ?' : '';
    const subBranchFilter = branchId ? 'AND sr.branch_id = ?' : '';
    const subBrandFilter = brandId ? 'AND sr.brand_id = ?' : '';
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
           ${subBrandFilter}
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
           ${subBrandFilter}
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
    if (branchId) params.push(branchId);
    if (brandId) params.push(brandId);
    if (salesman_id) params.push(salesman_id);

    // Push params for subquery 2 (returns_qty)
    if (startDate && endDate) params.push(startDate, endDate);
    if (vendor_id) params.push(vendor_id);
    if (branchId) params.push(branchId);
    if (brandId) params.push(brandId);
    if (salesman_id) params.push(salesman_id);

    // Outer query filters
    if (startDate && endDate) {
      query += ` AND DATE(s.created_at) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    if (vendor_id) { query += ` AND s.vendor_id = ?`; params.push(vendor_id); }
    if (branchId) { query += ` AND s.branch_id = ?`; params.push(branchId); }
    if (brandId) { query += ` AND s.brand_id = ?`; params.push(brandId); }
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

export const getFoodCostReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { brandId, branchId } = getReportScope(req);
    const today = new Date().toISOString().split('T')[0];
    
    const start = startDate ? String(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = endDate ? String(endDate) : today;

    // Build filters and parameters
    let itemsQuery = `
      SELECT ii.inventory_item_id, ii.name_en, ii.name_ar, ii.sku, ii.current_stock, ii.min_stock_level, ii.unit_en, ii.unit_ar, ii.cost_price,
      c.name_en as category_name
      FROM inventory_items ii
      LEFT JOIN categories c ON ii.category_id = c.category_id
      WHERE ii.deleted_at IS NULL
    `;
    const itemsParams: any[] = [];
    if (brandId) {
      itemsQuery += ` AND ii.brand_id = ?`;
      itemsParams.push(brandId);
    }
    itemsQuery += ` ORDER BY c.name_en ASC, ii.name_en ASC`;

    // 1. Fetch active inventory items
    const [items]: any = await pool.execute(itemsQuery, itemsParams);

    // 2. Fetch receiving quantities for all items in date range in bulk
    let recQuery = `
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) BETWEEN ? AND ?
    `;
    const recParams: any[] = [start, end];
    if (branchId) {
      recQuery += ` AND po.branch_id = ?`;
      recParams.push(branchId);
    }
    if (brandId) {
      recQuery += ` AND po.brand_id = ?`;
      recParams.push(brandId);
    }
    recQuery += ` GROUP BY poi.inventory_item_id`;
    const [receivingRows]: any = await pool.execute(recQuery, recParams);
    const receivingMap = new Map(receivingRows.map((r: any) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));

    // 3. Fetch wastage quantities in date range in bulk
    let wasteQuery = `
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      LEFT JOIN admins a ON w.admin_id = a.admin_id
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) BETWEEN ? AND ?
    `;
    const wasteParams: any[] = [start, end];
    if (branchId) {
      wasteQuery += ` AND (w.branch_id = ? OR a.branch_id = ?)`;
      wasteParams.push(branchId, branchId);
    }
    if (brandId) {
      wasteQuery += ` AND (w.brand_id = ? OR a.brand_id = ?)`;
      wasteParams.push(brandId, brandId);
    }
    wasteQuery += ` GROUP BY w.inventory_item_id`;
    const [wastageRows]: any = await pool.execute(wasteQuery, wasteParams);
    const wastageMap = new Map(wastageRows.map((r: any) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));

    // 4. Fetch production usage in date range in bulk
    let prodQuery = `
      SELECT mii.inventory_item_id, SUM(pi.quantity_produced * mii.quantity * IFNULL(iip.multiplier, 1)) as total_qty
      FROM production_items pi
      JOIN production_logs pl ON pi.production_id = pl.production_id
      JOIN menu_item_ingredients mii ON pi.menu_item_id = mii.menu_item_id
      LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
      WHERE pl.deleted_at IS NULL
        AND DATE(pl.production_date) BETWEEN ? AND ?
    `;
    const prodParams: any[] = [start, end];
    if (branchId) {
      prodQuery += ` AND pl.branch_id = ?`;
      prodParams.push(branchId);
    }
    if (brandId) {
      prodQuery += ` AND pl.brand_id = ?`;
      prodParams.push(brandId);
    }
    prodQuery += ` GROUP BY mii.inventory_item_id`;
    const [productionRows]: any = await pool.execute(prodQuery, prodParams);
    const productionMap = new Map(productionRows.map((r: any) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));

    // 5. Fetch receiving since start in bulk (for opening stock back-calc)
    let recSinceStartQuery = `
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) >= ?
    `;
    const recSinceStartParams: any[] = [start];
    if (branchId) {
      recSinceStartQuery += ` AND po.branch_id = ?`;
      recSinceStartParams.push(branchId);
    }
    if (brandId) {
      recSinceStartQuery += ` AND po.brand_id = ?`;
      recSinceStartParams.push(brandId);
    }
    recSinceStartQuery += ` GROUP BY poi.inventory_item_id`;
    const [recSinceStartRows]: any = await pool.execute(recSinceStartQuery, recSinceStartParams);
    const recSinceStartMap = new Map(recSinceStartRows.map((r: any) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));

    // 6. Fetch wastage since start in bulk (for opening stock back-calc)
    let wasteSinceStartQuery = `
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      LEFT JOIN admins a ON w.admin_id = a.admin_id
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) >= ?
    `;
    const wasteSinceStartParams: any[] = [start];
    if (branchId) {
      wasteSinceStartQuery += ` AND (w.branch_id = ? OR a.branch_id = ?)`;
      wasteSinceStartParams.push(branchId, branchId);
    }
    if (brandId) {
      wasteSinceStartQuery += ` AND (w.brand_id = ? OR a.brand_id = ?)`;
      wasteSinceStartParams.push(brandId, brandId);
    }
    wasteSinceStartQuery += ` GROUP BY w.inventory_item_id`;
    const [wasteSinceStartRows]: any = await pool.execute(wasteSinceStartQuery, wasteSinceStartParams);
    const wasteSinceStartMap = new Map(wasteSinceStartRows.map((r: any) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));

    // 7. Fetch production usage since start in bulk (for opening stock back-calc)
    let prodSinceStartQuery = `
      SELECT mii.inventory_item_id, SUM(pi.quantity_produced * mii.quantity * IFNULL(iip.multiplier, 1)) as total_qty
      FROM production_items pi
      JOIN production_logs pl ON pi.production_id = pl.production_id
      JOIN menu_item_ingredients mii ON pi.menu_item_id = mii.menu_item_id
      LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
      WHERE pl.deleted_at IS NULL
        AND DATE(pl.production_date) >= ?
    `;
    const prodSinceStartParams: any[] = [start];
    if (branchId) {
      prodSinceStartQuery += ` AND pl.branch_id = ?`;
      prodSinceStartParams.push(branchId);
    }
    if (brandId) {
      prodSinceStartQuery += ` AND pl.brand_id = ?`;
      prodSinceStartParams.push(brandId);
    }
    prodSinceStartQuery += ` GROUP BY mii.inventory_item_id`;
    const [prodSinceStartRows]: any = await pool.execute(prodSinceStartQuery, prodSinceStartParams);
    const prodSinceStartMap = new Map(prodSinceStartRows.map((r: any) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));

    // 8. Fetch receiving AFTER end date (for closing stock back-calc)
    let recAfterEndQuery = `
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) > ?
    `;
    const recAfterEndParams: any[] = [end];
    if (branchId) {
      recAfterEndQuery += ` AND po.branch_id = ?`;
      recAfterEndParams.push(branchId);
    }
    if (brandId) {
      recAfterEndQuery += ` AND po.brand_id = ?`;
      recAfterEndParams.push(brandId);
    }
    recAfterEndQuery += ` GROUP BY poi.inventory_item_id`;
    const [recAfterEndRows]: any = await pool.execute(recAfterEndQuery, recAfterEndParams);
    const recAfterEndMap = new Map(recAfterEndRows.map((r: any) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));

    // 9. Fetch wastage AFTER end date (for closing stock back-calc)
    let wasteAfterEndQuery = `
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      LEFT JOIN admins a ON w.admin_id = a.admin_id
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) > ?
    `;
    const wasteAfterEndParams: any[] = [end];
    if (branchId) {
      wasteAfterEndQuery += ` AND (w.branch_id = ? OR a.branch_id = ?)`;
      wasteAfterEndParams.push(branchId, branchId);
    }
    if (brandId) {
      wasteAfterEndQuery += ` AND (w.brand_id = ? OR a.brand_id = ?)`;
      wasteAfterEndParams.push(brandId, brandId);
    }
    wasteAfterEndQuery += ` GROUP BY w.inventory_item_id`;
    const [wasteAfterEndRows]: any = await pool.execute(wasteAfterEndQuery, wasteAfterEndParams);
    const wasteAfterEndMap = new Map(wasteAfterEndRows.map((r: any) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));

    // 10. Fetch production usage AFTER end date (for closing stock back-calc)
    let prodAfterEndQuery = `
      SELECT mii.inventory_item_id, SUM(pi.quantity_produced * mii.quantity * IFNULL(iip.multiplier, 1)) as total_qty
      FROM production_items pi
      JOIN production_logs pl ON pi.production_id = pl.production_id
      JOIN menu_item_ingredients mii ON pi.menu_item_id = mii.menu_item_id
      LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
      WHERE pl.deleted_at IS NULL
        AND DATE(pl.production_date) > ?
    `;
    const prodAfterEndParams: any[] = [end];
    if (branchId) {
      prodAfterEndQuery += ` AND pl.branch_id = ?`;
      prodAfterEndParams.push(branchId);
    }
    if (brandId) {
      prodAfterEndQuery += ` AND pl.brand_id = ?`;
      prodAfterEndParams.push(brandId);
    }
    prodAfterEndQuery += ` GROUP BY mii.inventory_item_id`;
    const [prodAfterEndRows]: any = await pool.execute(prodAfterEndQuery, prodAfterEndParams);
    const prodAfterEndMap = new Map(prodAfterEndRows.map((r: any) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));

    // 11. Assemble report data
    const reportData = items.map((item: any) => {
      const itemId = item.inventory_item_id;
      const receivingQty = receivingMap.get(itemId) || 0;
      const wastageQty = wastageMap.get(itemId) || 0;
      const productionQty = productionMap.get(itemId) || 0;

      const recSinceStart = Number(recSinceStartMap.get(itemId) || 0);
      const wasteSinceStart = Number(wasteSinceStartMap.get(itemId) || 0);
      const prodSinceStart = Number(prodSinceStartMap.get(itemId) || 0);

      // Opening Stock = what stock was at the START of the period
      // Back-calc: reverse everything that happened from startDate onwards
      const openingStock = Math.max(0, parseFloat(item.current_stock) - recSinceStart + wasteSinceStart + prodSinceStart);

      const recAfterEnd = Number(recAfterEndMap.get(itemId) || 0);
      const wasteAfterEnd = Number(wasteAfterEndMap.get(itemId) || 0);
      const prodAfterEnd = Number(prodAfterEndMap.get(itemId) || 0);

      // Closing Stock = what stock was at the END of the period
      // Back-calc: reverse everything that happened AFTER endDate
      const closingStock = Math.max(0, parseFloat(item.current_stock) - recAfterEnd + wasteAfterEnd + prodAfterEnd);

      return {
        inventory_item_id: item.inventory_item_id,
        name_en: item.name_en,
        name_ar: item.name_ar,
        sku: item.sku,
        unit_en: item.unit_en,
        unit_ar: item.unit_ar,
        cost_price: parseFloat(item.cost_price),
        category_name: item.category_name,
        opening_stock: openingStock,
        receiving_stock: receivingQty,
        wastage: wastageQty,
        production_used: productionQty,
        current_stock: closingStock   // now represents end-of-period stock, not live stock
      };
    });

    let salesQuery = `
      SELECT SUM(total_amount) as revenue
      FROM sales_orders
      WHERE deleted_at IS NULL
        AND DATE(created_at) BETWEEN ? AND ?
    `;
    const salesParams: any[] = [start, end];
    if (branchId) {
      salesQuery += ` AND branch_id = ?`;
      salesParams.push(branchId);
    }
    if (brandId) {
      salesQuery += ` AND brand_id = ?`;
      salesParams.push(brandId);
    }
    const [salesRows]: any = await pool.execute(salesQuery, salesParams);
    const salesRevenue = parseFloat(salesRows[0]?.revenue || 0);

    return successResponse(res, {
      items: reportData,
      sales_revenue: salesRevenue
    });
  } catch (error) {
    console.error('Food Cost Report Error:', error);
    return errorResponse(res, 'Failed to fetch food cost report', 500, error);
  }
};

export const getClientStatements = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, vendor_id } = req.query;
    const { brandId, branchId } = getReportScope(req);
    
    let query = `
      SELECT s.*, 
             v.name_en as client_name, v.name_ar as client_name_ar, v.email as client_email, v.phone as client_phone, v.address as client_address,
             pb.name_en as branch_name, pb.name_ar as branch_name_ar,
             DATE_FORMAT(s.created_at, '%Y-%m-%d') as report_date,
             IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0) as returns_amount,
             IFNULL((SELECT SUM(sri.quantity) FROM sales_returns sr JOIN sales_return_items sri ON sr.return_id = sri.return_id WHERE sr.sale_id = s.sale_id), 0) as returns_qty
      FROM sales_orders s
      JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      WHERE s.deleted_at IS NULL AND v.type = 'client'
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
    if (branchId) {
      query += ` AND s.branch_id = ?`;
      params.push(branchId);
    }
    if (brandId) {
      query += ` AND s.brand_id = ?`;
      params.push(brandId);
    }
    
    query += ` ORDER BY s.created_at DESC, s.sale_id DESC`;
    
    const [orders]: any = await pool.execute(query, params);
    
    if (orders.length === 0) {
      return successResponse(res, []);
    }
    
    const orderIds = orders.map((o: any) => o.sale_id);
    const placeholders = orderIds.map(() => '?').join(',');
    
    const [items]: any = await pool.execute(`
      SELECT soi.*, mi.name_en, mi.name_ar,
        (SELECT COALESCE(SUM(sri.quantity), 0)
         FROM sales_return_items sri
         JOIN sales_returns sr ON sri.return_id = sr.return_id
         WHERE sr.sale_id = soi.sale_id AND sri.menu_item_id = soi.menu_item_id) as returns_qty
      FROM sales_order_items soi
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      WHERE soi.sale_id IN (${placeholders})
    `, orderIds);
    
    const ordersWithItems = orders.map((order: any) => {
      return {
        ...order,
        items: items.filter((item: any) => item.sale_id === order.sale_id)
      };
    });
    
    return successResponse(res, ordersWithItems);
  } catch (error) {
    console.error('Client Statements Error:', error);
    return errorResponse(res, 'Failed to fetch client statements', 500, error);
  }
};


export const getOperationalPNL = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { brandId, branchId } = getReportScope(req);
    
    // Default to current year if no dates provided
    let dateFilter = '';
    let params: any[] = [];
    if (startDate && endDate) {
      dateFilter = 'AND DATE(created_at) BETWEEN ? AND ?';
      params = [startDate, endDate];
    }

    // 1. SALES BY CATEGORY
    let salesQuery = `
      SELECT 
        COALESCE(c.name_en, 'Uncategorized') as category_name, 
        SUM(soi.quantity * soi.price) as total_sales, 
        SUM(soi.quantity * COALESCE(mi.cost_price, 0)) as total_cogs
      FROM sales_order_items soi
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      LEFT JOIN categories c ON mi.category_id = c.category_id
      JOIN sales_orders s ON soi.sale_id = s.sale_id
      WHERE s.deleted_at IS NULL ${dateFilter.replace('created_at', 's.created_at')}
    `;
    const salesParams = [...params];
    if (branchId) {
      salesQuery += ` AND s.branch_id = ?`;
      salesParams.push(branchId);
    }
    if (brandId) {
      salesQuery += ` AND s.brand_id = ?`;
      salesParams.push(brandId);
    }
    salesQuery += ` GROUP BY c.name_en`;
    const [salesRaw]: any = await pool.execute(salesQuery, salesParams);

    // 2. RETURNS BY CATEGORY (to deduct from sales)
    let returnsQuery = `
      SELECT 
        COALESCE(c.name_en, 'Uncategorized') as category_name, 
        SUM(sri.quantity * COALESCE(mi.price, 0)) as total_returns, 
        SUM(sri.quantity * COALESCE(mi.cost_price, 0)) as return_cogs
      FROM sales_return_items sri
      JOIN menu_items mi ON sri.menu_item_id = mi.menu_item_id
      LEFT JOIN categories c ON mi.category_id = c.category_id
      JOIN sales_returns sr ON sri.return_id = sr.return_id
      WHERE 1=1 ${dateFilter.replace('created_at', 'sr.created_at')}
    `;
    const returnsParams = [...params];
    if (branchId) {
      returnsQuery += ` AND sr.branch_id = ?`;
      returnsParams.push(branchId);
    }
    if (brandId) {
      returnsQuery += ` AND sr.brand_id = ?`;
      returnsParams.push(brandId);
    }
    returnsQuery += ` GROUP BY c.name_en`;
    const [returnsRaw]: any = await pool.execute(returnsQuery, returnsParams);

    // Merge Sales and Returns
    const salesMap = new Map();
    salesRaw.forEach((row: any) => {
      salesMap.set(row.category_name, {
        category: row.category_name,
        sales: Number(row.total_sales),
        cogs: Number(row.total_cogs)
      });
    });

    returnsRaw.forEach((row: any) => {
      if (salesMap.has(row.category_name)) {
        const existing = salesMap.get(row.category_name);
        existing.sales -= Number(row.total_returns);
        existing.cogs -= Number(row.return_cogs);
      } else {
        salesMap.set(row.category_name, {
          category: row.category_name,
          sales: -Number(row.total_returns),
          cogs: -Number(row.return_cogs)
        });
      }
    });

    const salesByCategory = Array.from(salesMap.values());

    // 3. OPERATIONAL EXPENSES
    // Pull Labor Expenses from Employees table
    let employeesQuery = `
      SELECT role as category, SUM(salary) as amount 
      FROM employees 
      WHERE deleted_at IS NULL AND status = 'active'
    `;
    const employeesParams: any[] = [];
    if (branchId) {
      employeesQuery += ` AND branch_id = ?`;
      employeesParams.push(branchId);
    }
    if (brandId) {
      employeesQuery += ` AND brand_id = ?`;
      employeesParams.push(brandId);
    }
    employeesQuery += ` GROUP BY role`;
    const [laborRaw]: any = await pool.execute(employeesQuery, employeesParams);
    const laborExpenses = laborRaw.map((e: any) => ({ category: e.category, amount: Number(e.amount) }));

    // Pull Other Expenses from operational_expenses
    let expensesQuery = `
      SELECT category, SUM(amount) as total
      FROM operational_expenses
      WHERE type = 'Other Expense' ${dateFilter.replace('created_at', 'expense_date')}
    `;
    const expensesParams: any[] = [...params];
    if (branchId) {
      expensesQuery += ` AND branch_id = ?`;
      expensesParams.push(branchId);
    }
    if (brandId) {
      expensesQuery += ` AND brand_id = ?`;
      expensesParams.push(brandId);
    }
    expensesQuery += ` GROUP BY category`;
    const [expensesRaw]: any = await pool.execute(expensesQuery, expensesParams);
    const otherExpenses = expensesRaw.map((e: any) => ({ category: e.category, amount: Number(e.total) }));

    // Calculate Asset Depreciation (Monthly)
    let assetsQuery = `SELECT name, value, depreciation_rate FROM company_assets WHERE 1=1`;
    const assetsParams: any[] = [];
    if (branchId) {
      assetsQuery += ` AND branch_id = ?`;
      assetsParams.push(branchId);
    }
    if (brandId) {
      assetsQuery += ` AND brand_id = ?`;
      assetsParams.push(brandId);
    }
    const [assetsRaw]: any = await pool.execute(assetsQuery, assetsParams);
    
    let totalMonthlyDepreciation = 0;
    assetsRaw.forEach((asset: any) => {
      const val = Number(asset.value) || 0;
      const rate = Number(asset.depreciation_rate) || 0;
      if (val > 0 && rate > 0) {
        // Annual depreciation is (val * rate / 100), monthly is divided by 12
        const monthlyDepreciation = (val * (rate / 100)) / 12;
        totalMonthlyDepreciation += monthlyDepreciation;
      }
    });

    if (totalMonthlyDepreciation > 0) {
      otherExpenses.push({
        category: 'Asset Depreciation (Monthly)',
        amount: totalMonthlyDepreciation
      });
    }

    // Calculate Liability Interest (Monthly)
    let liabilitiesQuery = `SELECT name, amount, interest_rate FROM company_liabilities WHERE 1=1`;
    const liabilitiesParams: any[] = [];
    if (branchId) {
      liabilitiesQuery += ` AND branch_id = ?`;
      liabilitiesParams.push(branchId);
    }
    if (brandId) {
      liabilitiesQuery += ` AND brand_id = ?`;
      liabilitiesParams.push(brandId);
    }
    const [liabilitiesRaw]: any = await pool.execute(liabilitiesQuery, liabilitiesParams);

    let totalMonthlyInterest = 0;
    liabilitiesRaw.forEach((liability: any) => {
      const amt = Number(liability.amount) || 0;
      // interest_rate might be '5%' or '5'
      const rawRate = liability.interest_rate || '';
      const rateNum = parseFloat(rawRate.toString().replace('%', ''));
      if (amt > 0 && !isNaN(rateNum) && rateNum > 0) {
        // Assuming rate is annual percentage, monthly is divided by 12
        const monthlyInterest = (amt * (rateNum / 100)) / 12;
        totalMonthlyInterest += monthlyInterest;
      }
    });

    if (totalMonthlyInterest > 0) {
      otherExpenses.push({
        category: 'Liability Interest (Monthly)',
        amount: totalMonthlyInterest
      });
    }

    const totalSales = salesByCategory.reduce((sum, item) => sum + item.sales, 0);
    const totalCogs = salesByCategory.reduce((sum, item) => sum + item.cogs, 0);
    const grossProfit = totalSales - totalCogs;
    
    const totalLabor = laborExpenses.reduce((sum: number, item: any) => sum + item.amount, 0);
    const totalOther = otherExpenses.reduce((sum: number, item: any) => sum + item.amount, 0);
    const netIncome = grossProfit - totalLabor - totalOther;

    return successResponse(res, {
      salesByCategory,
      totalSales,
      totalCogs,
      grossProfit,
      laborExpenses,
      totalLabor,
      otherExpenses,
      totalOther,
      netIncome
    });

  } catch (error) {
    console.error('Operational PNL Error:', error);
    return errorResponse(res, 'Failed to generate operational PNL', 500, error);
  }
};
