import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
export const getSalesReport = async (req, res) => {
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
        const params = [];
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
        const [rows] = await pool.execute(query, params);
        return successResponse(res, rows);
    }
    catch (error) {
        console.error('Sales Report Error:', error);
        return errorResponse(res, 'Failed to fetch sales report', 500, error);
    }
};
export const getProductionReport = async (req, res) => {
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
        const params = [];
        if (startDate && endDate) {
            // Use DATE() to handle both DATE and DATETIME columns correctly
            query += ` AND DATE(COALESCE(pl.production_date, pl.created_at)) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }
        query += ` ORDER BY COALESCE(pl.production_date, pl.created_at) DESC`;
        const [rows] = await pool.execute(query, params);
        return successResponse(res, rows);
    }
    catch (error) {
        console.error('Production Report Error:', error);
        return errorResponse(res, 'Failed to fetch production report', 500, error);
    }
};
export const getWastageReport = async (req, res) => {
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
        const params = [];
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
        const [rows] = await pool.execute(query, params);
        return successResponse(res, rows);
    }
    catch (error) {
        console.error('Wastage Report Error:', error);
        return errorResponse(res, 'Failed to fetch wastage report', 500, error);
    }
};
export const getAnalyticsSummary = async (req, res) => {
    try {
        const { startDate, endDate, vendor_id, branch_id, salesman_id } = req.query;
        const params = [];
        let dateFilter = "";
        if (startDate && endDate) {
            dateFilter = " AND DATE(s.created_at) BETWEEN ? AND ?";
            params.push(startDate, endDate);
        }
        const vendorFilter = vendor_id ? " AND s.vendor_id = ?" : "";
        if (vendor_id)
            params.push(vendor_id);
        const branchFilter = branch_id ? " AND s.branch_id = ?" : "";
        if (branch_id)
            params.push(branch_id);
        const salesmanFilter = salesman_id ? " AND s.salesman_id = ?" : "";
        if (salesman_id)
            params.push(salesman_id);
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
        const wastageParams = [];
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
        const [dailyTrend] = await pool.execute(dailyQuery, params);
        const [topCustomers] = await pool.execute(customersQuery, params);
        const [wastageReasons] = await pool.execute(wastageQuery, wastageParams);
        return successResponse(res, {
            dailyTrend,
            topCustomers,
            wastageReasons
        });
    }
    catch (error) {
        console.error('Analytics Summary Error:', error);
        return errorResponse(res, 'Failed to fetch analytics summary', 500, error);
    }
};
export const getPurchaseReport = async (req, res) => {
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
        const params = [];
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
        const [rows] = await pool.execute(query, params);
        return successResponse(res, rows);
    }
    catch (error) {
        console.error('Purchase Report Error:', error);
        return errorResponse(res, 'Failed to fetch purchase report', 500, error);
    }
};
export const getProductPerformanceReport = async (req, res) => {
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
        const params = [];
        // Push params for subquery 1 (returns_loss)
        if (startDate && endDate)
            params.push(startDate, endDate);
        if (vendor_id)
            params.push(vendor_id);
        if (branch_id)
            params.push(branch_id);
        if (salesman_id)
            params.push(salesman_id);
        // Push params for subquery 2 (returns_qty)
        if (startDate && endDate)
            params.push(startDate, endDate);
        if (vendor_id)
            params.push(vendor_id);
        if (branch_id)
            params.push(branch_id);
        if (salesman_id)
            params.push(salesman_id);
        // Outer query filters
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
        query += ` GROUP BY mi.menu_item_id ORDER BY total_sold DESC`;
        const [rows] = await pool.execute(query, params);
        // 🚀 WOW ENRICHMENT
        const totalRevenue = rows.reduce((acc, r) => acc + Number(r.revenue), 0);
        const enrichedRows = rows.map((r) => ({
            ...r,
            net_profit: (Number(r.revenue) - Number(r.total_cost) - Number(r.returns_loss)).toFixed(3),
            contribution: totalRevenue > 0 ? ((Number(r.revenue) / totalRevenue) * 100).toFixed(1) : 0,
            return_rate: r.total_sold > 0 ? ((Number(r.returns_qty) / Number(r.total_sold)) * 100).toFixed(1) : 0
        }));
        return successResponse(res, enrichedRows);
    }
    catch (error) {
        console.error('Product Performance Sales-Centric Error:', error);
        return errorResponse(res, 'Failed to fetch product performance report', 500, error);
    }
};
export const getFoodCostReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const today = new Date().toISOString().split('T')[0];
        const start = startDate ? String(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const end = endDate ? String(endDate) : today;
        // 1. Fetch active inventory items
        const [items] = await pool.execute(`
      SELECT ii.inventory_item_id, ii.name_en, ii.name_ar, ii.sku, ii.current_stock, ii.min_stock_level, ii.unit_en, ii.unit_ar, ii.cost_price,
      c.name_en as category_name
      FROM inventory_items ii
      LEFT JOIN categories c ON ii.category_id = c.category_id
      WHERE ii.deleted_at IS NULL
      ORDER BY c.name_en ASC, ii.name_en ASC
    `);
        // 2. Fetch receiving quantities for all items in date range in bulk
        const [receivingRows] = await pool.execute(`
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) BETWEEN ? AND ?
      GROUP BY poi.inventory_item_id
    `, [start, end]);
        const receivingMap = new Map(receivingRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
        // 3. Fetch wastage quantities in date range in bulk
        const [wastageRows] = await pool.execute(`
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) BETWEEN ? AND ?
      GROUP BY w.inventory_item_id
    `, [start, end]);
        const wastageMap = new Map(wastageRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
        // 4. Fetch production usage in date range in bulk
        const [productionRows] = await pool.execute(`
      SELECT mii.inventory_item_id, SUM(pi.quantity_produced * mii.quantity * IFNULL(iip.multiplier, 1)) as total_qty
      FROM production_items pi
      JOIN production_logs pl ON pi.production_id = pl.production_id
      JOIN menu_item_ingredients mii ON pi.menu_item_id = mii.menu_item_id
      LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
      WHERE pl.deleted_at IS NULL
        AND DATE(pl.production_date) BETWEEN ? AND ?
      GROUP BY mii.inventory_item_id
    `, [start, end]);
        const productionMap = new Map(productionRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
        // 5. Fetch receiving since start in bulk (for opening stock back-calc)
        const [recSinceStartRows] = await pool.execute(`
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) >= ?
      GROUP BY poi.inventory_item_id
    `, [start]);
        const recSinceStartMap = new Map(recSinceStartRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
        // 6. Fetch wastage since start in bulk (for opening stock back-calc)
        const [wasteSinceStartRows] = await pool.execute(`
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) >= ?
      GROUP BY w.inventory_item_id
    `, [start]);
        const wasteSinceStartMap = new Map(wasteSinceStartRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
        // 7. Fetch production usage since start in bulk (for opening stock back-calc)
        const [prodSinceStartRows] = await pool.execute(`
      SELECT mii.inventory_item_id, SUM(pi.quantity_produced * mii.quantity * IFNULL(iip.multiplier, 1)) as total_qty
      FROM production_items pi
      JOIN production_logs pl ON pi.production_id = pl.production_id
      JOIN menu_item_ingredients mii ON pi.menu_item_id = mii.menu_item_id
      LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
      WHERE pl.deleted_at IS NULL
        AND DATE(pl.production_date) >= ?
      GROUP BY mii.inventory_item_id
    `, [start]);
        const prodSinceStartMap = new Map(prodSinceStartRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
        // 8. Fetch receiving AFTER end date (for closing stock back-calc)
        const [recAfterEndRows] = await pool.execute(`
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) > ?
      GROUP BY poi.inventory_item_id
    `, [end]);
        const recAfterEndMap = new Map(recAfterEndRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
        // 9. Fetch wastage AFTER end date (for closing stock back-calc)
        const [wasteAfterEndRows] = await pool.execute(`
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) > ?
      GROUP BY w.inventory_item_id
    `, [end]);
        const wasteAfterEndMap = new Map(wasteAfterEndRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
        // 10. Fetch production usage AFTER end date (for closing stock back-calc)
        const [prodAfterEndRows] = await pool.execute(`
      SELECT mii.inventory_item_id, SUM(pi.quantity_produced * mii.quantity * IFNULL(iip.multiplier, 1)) as total_qty
      FROM production_items pi
      JOIN production_logs pl ON pi.production_id = pl.production_id
      JOIN menu_item_ingredients mii ON pi.menu_item_id = mii.menu_item_id
      LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
      WHERE pl.deleted_at IS NULL
        AND DATE(pl.production_date) > ?
      GROUP BY mii.inventory_item_id
    `, [end]);
        const prodAfterEndMap = new Map(prodAfterEndRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
        // 11. Assemble report data
        const reportData = items.map((item) => {
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
                current_stock: closingStock // now represents end-of-period stock, not live stock
            };
        });
        const [salesRows] = await pool.execute(`
      SELECT SUM(final_amount) as revenue
      FROM sales_orders
      WHERE deleted_at IS NULL
        AND DATE(created_at) BETWEEN ? AND ?
    `, [start, end]);
        const salesRevenue = parseFloat(salesRows[0]?.revenue || 0);
        return successResponse(res, {
            items: reportData,
            sales_revenue: salesRevenue
        });
    }
    catch (error) {
        console.error('Food Cost Report Error:', error);
        return errorResponse(res, 'Failed to fetch food cost report', 500, error);
    }
};
export const getClientStatements = async (req, res) => {
    try {
        const { startDate, endDate, vendor_id, branch_id } = req.query;
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
        const params = [];
        if (startDate && endDate) {
            query += ` AND DATE(s.created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }
        if (vendor_id) {
            query += ` AND s.vendor_id = ?`;
            params.push(vendor_id);
        }
        if (branch_id) {
            if (branch_id === 'main') {
                query += ` AND (s.branch_id IS NULL OR s.branch_id = 'main' OR s.branch_id = 0)`;
            }
            else {
                query += ` AND s.branch_id = ?`;
                params.push(branch_id);
            }
        }
        query += ` ORDER BY s.created_at DESC, s.sale_id DESC`;
        const [orders] = await pool.execute(query, params);
        if (orders.length === 0) {
            return successResponse(res, []);
        }
        const orderIds = orders.map((o) => o.sale_id);
        const placeholders = orderIds.map(() => '?').join(',');
        const [items] = await pool.execute(`
      SELECT soi.*, mi.name_en, mi.name_ar,
        (SELECT COALESCE(SUM(sri.quantity), 0)
         FROM sales_return_items sri
         JOIN sales_returns sr ON sri.return_id = sr.return_id
         WHERE sr.sale_id = soi.sale_id AND sri.menu_item_id = soi.menu_item_id) as returns_qty
      FROM sales_order_items soi
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      WHERE soi.sale_id IN (${placeholders})
    `, orderIds);
        const ordersWithItems = orders.map((order) => {
            return {
                ...order,
                items: items.filter((item) => item.sale_id === order.sale_id)
            };
        });
        return successResponse(res, ordersWithItems);
    }
    catch (error) {
        console.error('Client Statements Error:', error);
        return errorResponse(res, 'Failed to fetch client statements', 500, error);
    }
};
export const getOperationalPNL = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Default to current year if no dates provided
        let dateFilter = '';
        let params = [];
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
      GROUP BY c.name_en
    `;
        const [salesRaw] = await pool.execute(salesQuery, params);
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
      GROUP BY c.name_en
    `;
        const [returnsRaw] = await pool.execute(returnsQuery, params);
        // Merge Sales and Returns
        const salesMap = new Map();
        salesRaw.forEach((row) => {
            salesMap.set(row.category_name, {
                category: row.category_name,
                sales: Number(row.total_sales),
                cogs: Number(row.total_cogs)
            });
        });
        returnsRaw.forEach((row) => {
            if (salesMap.has(row.category_name)) {
                const existing = salesMap.get(row.category_name);
                existing.sales -= Number(row.total_returns);
                existing.cogs -= Number(row.return_cogs);
            }
            else {
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
      GROUP BY role
    `;
        const [laborRaw] = await pool.execute(employeesQuery);
        const laborExpenses = laborRaw.map((e) => ({ category: e.category, amount: Number(e.amount) }));
        // Pull Other Expenses from operational_expenses
        let expensesQuery = `
      SELECT category, SUM(amount) as total
      FROM operational_expenses
      WHERE type = 'Other Expense' ${dateFilter.replace('created_at', 'expense_date')}
      GROUP BY category
    `;
        const [expensesRaw] = await pool.execute(expensesQuery, params);
        const otherExpenses = expensesRaw.map((e) => ({ category: e.category, amount: Number(e.total) }));
        // Calculate Asset Depreciation (Monthly)
        let assetsQuery = `SELECT name, value, depreciation_rate FROM company_assets`;
        const [assetsRaw] = await pool.execute(assetsQuery);
        let totalMonthlyDepreciation = 0;
        assetsRaw.forEach((asset) => {
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
        let liabilitiesQuery = `SELECT name, amount, interest_rate FROM company_liabilities`;
        const [liabilitiesRaw] = await pool.execute(liabilitiesQuery);
        let totalMonthlyInterest = 0;
        liabilitiesRaw.forEach((liability) => {
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
        const totalLabor = laborExpenses.reduce((sum, item) => sum + item.amount, 0);
        const totalOther = otherExpenses.reduce((sum, item) => sum + item.amount, 0);
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
    }
    catch (error) {
        console.error('Operational PNL Error:', error);
        return errorResponse(res, 'Failed to generate operational PNL', 500, error);
    }
};
