import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';
export const getTransactions = async (req, res) => {
    try {
        const [transactions] = await pool.execute(`
      (SELECT 
        s.sale_id as id, 
        'Direct Sales' as category, 
        s.total_amount as amount, 
        'income' as type, 
        DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i') as date,
        'completed' as status,
        s.order_number as reference,
        COALESCE(v.name_en, s.customer_name) as party_name
      FROM sales_orders s
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id)
      
      UNION ALL
      
      (SELECT 
        p.purchase_id as id, 
        'Inventory Purchase' as category, 
        p.final_amount as amount, 
        'expense' as type, 
        DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') as date,
        CASE WHEN p.status = 'received' THEN 'completed' ELSE 'pending' END as status,
        p.po_number as reference,
        v.name_en as party_name
      FROM purchase_orders p
      JOIN vendors v ON p.vendor_id = v.vendor_id)

      UNION ALL

      (SELECT 
        r.return_id as id, 
        'Return Credit' as category, 
        r.total_credit_amount as amount, 
        'expense' as type, 
        DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i') as date,
        'completed' as status,
        'RET-BATCH' as reference,
        v.name_en as party_name
      FROM sales_returns r
      JOIN vendors v ON r.vendor_id = v.vendor_id)
      
      ORDER BY date DESC 
      LIMIT 100
    `);
        return successResponse(res, transactions);
    }
    catch (error) {
        return errorResponse(res, 'Failed to fetch transaction history', 500, error);
    }
};
export const getFinancialSummary = async (req, res) => {
    try {
        const [income] = await pool.execute('SELECT SUM(total_amount) as total FROM sales_orders');
        const [expense] = await pool.execute('SELECT SUM(final_amount) as total FROM purchase_orders');
        const [returns] = await pool.execute('SELECT SUM(total_credit_amount) as total FROM sales_returns');
        const totalIncome = Number(income[0]?.total || 0);
        const totalExpense = Number(expense[0]?.total || 0) + Number(returns[0]?.total || 0);
        return successResponse(res, {
            totalIncome,
            totalExpense,
            netProfit: totalIncome - totalExpense,
            currency: 'KWD'
        });
    }
    catch (error) {
        return errorResponse(res, 'Summary calculation failed', 500, error);
    }
};
