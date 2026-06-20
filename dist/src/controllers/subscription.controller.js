import pool, { masterPool } from '../config/db';
import razorpay from '../config/razorpay';
import crypto from 'crypto';
import { successResponse, errorResponse } from '../utils/response';
import { config } from '../config/config';
// Pricing in USD (since Razorpay key is test and charges in USD/INR easily)
const PRICE_BASE_YEARLY_USD = 650.00;
const PRICE_BRANCH_YEARLY_USD = 325.00;
const PRICE_COUNTER_YEARLY_USD = 160.00;
const PRICE_USER_YEARLY_USD = 160.00;
export const getSubscriptionStatus = async (req, res) => {
    const dbName = req.user?.tenant_db;
    if (!dbName || dbName === 'kms_master') {
        return errorResponse(res, 'Invalid tenant context', 400);
    }
    try {
        // 1. Get tenant details from master database
        const [tenants] = await masterPool.execute('SELECT * FROM tenants WHERE db_name = ?', [dbName]);
        if (!tenants || tenants.length === 0) {
            return errorResponse(res, 'Tenant not found', 404);
        }
        const t = tenants[0];
        // 2. Fetch counts from tenant DB
        const [branchesRes] = await pool.execute('SELECT COUNT(*) as count FROM branches WHERE deleted_at IS NULL');
        const [usersRes] = await pool.execute('SELECT COUNT(*) as count FROM admins WHERE deleted_at IS NULL');
        let countersCount = 0;
        try {
            const [countersRes] = await pool.execute('SELECT COUNT(*) as count FROM pos_counters WHERE deleted_at IS NULL');
            countersCount = countersRes[0].count;
        }
        catch (e) {
            // Table might not exist or be empty yet
        }
        const branchesCount = branchesRes[0].count;
        const usersCount = usersRes[0].count;
        // 3. Calculate remaining days
        let remainingDays = 0;
        if (t.plan_end_date) {
            const endMs = new Date(t.plan_end_date).getTime();
            const nowMs = Date.now();
            remainingDays = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)));
        }
        return successResponse(res, {
            plan: t.plan,
            status: t.status,
            plan_start_date: t.plan_start_date,
            plan_end_date: t.plan_end_date,
            remaining_days: remainingDays,
            razorpay_key_id: config.razorpay.keyId,
            limits: {
                branches: {
                    active: branchesCount,
                    allowed: (t.base_branches || 1) + (t.extra_branches || 0),
                    base: t.base_branches || 1,
                    extra: t.extra_branches || 0,
                },
                counters: {
                    active: countersCount,
                    allowed: (t.base_counters || 1) + (t.extra_counters || 0),
                    base: t.base_counters || 1,
                    extra: t.extra_counters || 0,
                },
                users: {
                    active: usersCount,
                    allowed: (t.base_users || 3) + (t.extra_users || 0),
                    base: t.base_users || 3,
                    extra: t.extra_users || 0,
                }
            }
        });
    }
    catch (error) {
        console.error('Subscription Status Error:', error);
        return errorResponse(res, 'Failed to fetch subscription status', 500, error);
    }
};
export const createSubscriptionOrder = async (req, res) => {
    const dbName = req.user?.tenant_db;
    const { action, branches = 0, counters = 0, users = 0 } = req.body;
    if (!dbName || dbName === 'kms_master') {
        return errorResponse(res, 'Invalid tenant context', 400);
    }
    try {
        const [tenants] = await masterPool.execute('SELECT * FROM tenants WHERE db_name = ?', [dbName]);
        if (!tenants || tenants.length === 0) {
            return errorResponse(res, 'Tenant not found', 404);
        }
        const t = tenants[0];
        let usdAmount = 0;
        let details = '';
        if (action === 'renew') {
            usdAmount = PRICE_BASE_YEARLY_USD;
            details = 'Yearly Base Plan Subscription Renewal';
        }
        else if (action === 'upgrade') {
            // 1. Calculate pro-rata multiplier based on remaining days
            if (!t.plan_end_date) {
                return errorResponse(res, 'No active plan found to upgrade. Please subscribe first.', 400);
            }
            const endMs = new Date(t.plan_end_date).getTime();
            const nowMs = Date.now();
            const remainingDays = Math.max(0, (endMs - nowMs) / (1000 * 60 * 60 * 24));
            if (remainingDays <= 0) {
                return errorResponse(res, 'Your plan has expired. Please renew first.', 400);
            }
            const proRataMultiplier = remainingDays / 365.0;
            // 2. Compute pro-rated prices
            const branchCost = branches * PRICE_BRANCH_YEARLY_USD * proRataMultiplier;
            const counterCost = counters * PRICE_COUNTER_YEARLY_USD * proRataMultiplier;
            const userCost = users * PRICE_USER_YEARLY_USD * proRataMultiplier;
            usdAmount = branchCost + counterCost + userCost;
            details = `Upgrade: Add ${branches} branch(es), ${counters} counter(s), ${users} user(s) [Pro-rated for ${Math.ceil(remainingDays)} days]`;
            if (usdAmount <= 0) {
                return errorResponse(res, 'Invalid upgrade limits specified', 400);
            }
        }
        else {
            return errorResponse(res, 'Invalid billing action', 400);
        }
        // Razorpay accepts amounts in cents
        const amountInCents = Math.round(usdAmount * 100);
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInCents,
            currency: 'USD',
            receipt: `receipt_sub_${Date.now().toString(36)}`,
            notes: {
                tenant_id: t.tenant_id,
                action,
                branches,
                counters,
                users,
                details
            }
        });
        // Save transaction record to master DB as pending
        await masterPool.execute(`INSERT INTO tenant_transactions (tenant_id, payment_type, amount, razorpay_order_id, status)
       VALUES (?, ?, ?, ?, 'pending')`, [t.tenant_id, action === 'renew' ? 'base_plan' : 'add_branch', usdAmount, razorpayOrder.id]);
        return successResponse(res, {
            order_id: razorpayOrder.id,
            amount: usdAmount,
            currency: 'USD',
            details
        });
    }
    catch (error) {
        console.error('Create Subscription Order Error:', error);
        return errorResponse(res, 'Failed to initialize subscription checkout', 500, error);
    }
};
export const verifySubscriptionPayment = async (req, res) => {
    const dbName = req.user?.tenant_db;
    const { order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!order_id || !razorpay_payment_id || !razorpay_signature) {
        return errorResponse(res, 'Missing signature verification parameters', 400);
    }
    try {
        // 1. Verify Razorpay Signature
        const generatedSignature = crypto
            .createHmac('sha256', config.razorpay.keySecret)
            .update(order_id + '|' + razorpay_payment_id)
            .digest('hex');
        if (generatedSignature !== razorpay_signature) {
            return errorResponse(res, 'Payment verification failed: Signature mismatch', 400);
        }
        // 2. Fetch Razorpay Order from gateway to get notes/details safely
        const rzpOrder = await razorpay.orders.fetch(order_id);
        const notes = rzpOrder.notes;
        const tenantId = Number(notes.tenant_id);
        const action = notes.action;
        const addBranches = Number(notes.branches || 0);
        const addCounters = Number(notes.counters || 0);
        const addUsers = Number(notes.users || 0);
        // 3. Update master transaction to completed
        await masterPool.execute(`UPDATE tenant_transactions 
       SET status = 'completed', razorpay_payment_id = ?, razorpay_signature = ?
       WHERE razorpay_order_id = ?`, [razorpay_payment_id, razorpay_signature, order_id]);
        // 4. Update limits and start/end dates in master tenants table
        if (action === 'renew') {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setFullYear(startDate.getFullYear() + 1);
            await masterPool.execute(`UPDATE tenants 
         SET plan_start_date = ?, plan_end_date = ?, status = 'Active',
             base_branches = 1, base_counters = 1, base_users = 3
         WHERE tenant_id = ?`, [startDate, endDate, tenantId]);
        }
        else if (action === 'upgrade') {
            await masterPool.execute(`UPDATE tenants 
         SET extra_branches = extra_branches + ?, 
             extra_counters = extra_counters + ?, 
             extra_users = extra_users + ?
         WHERE tenant_id = ?`, [addBranches, addCounters, addUsers, tenantId]);
        }
        return successResponse(res, null, 'Payment verified and subscription limits upgraded successfully');
    }
    catch (error) {
        console.error('Verify Subscription Signature Error:', error);
        return errorResponse(res, 'Payment verification failed', 500, error);
    }
};
// ==========================================
// POS COUNTER MANAGEMENT CONTROLLER METHODS
// ==========================================
export const getCounters = async (req, res) => {
    try {
        const [rows] = await pool.execute(`
      SELECT pc.*, b.name_en as branch_name_en, b.name_ar as branch_name_ar
      FROM pos_counters pc
      LEFT JOIN branches b ON pc.branch_id = b.branch_id
      WHERE pc.deleted_at IS NULL
      ORDER BY pc.created_at DESC
    `);
        return successResponse(res, rows);
    }
    catch (error) {
        console.error('Get Counters Error:', error);
        return errorResponse(res, 'Failed to retrieve POS counters', 500, error);
    }
};
export const createCounter = async (req, res) => {
    const dbName = req.user?.tenant_db;
    const { branch_id, name } = req.body;
    if (!branch_id || !name) {
        return errorResponse(res, 'Branch and counter name are required', 400);
    }
    try {
        // 1. Enforce subscription limits
        const [tenants] = await masterPool.execute('SELECT * FROM tenants WHERE db_name = ?', [dbName]);
        if (!tenants || tenants.length === 0) {
            return errorResponse(res, 'Tenant context not found', 404);
        }
        const t = tenants[0];
        const allowedCounters = (t.base_counters || 1) + (t.extra_counters || 0);
        const [countersRes] = await pool.execute('SELECT COUNT(*) as count FROM pos_counters WHERE deleted_at IS NULL');
        const activeCounters = countersRes[0].count;
        if (activeCounters >= allowedCounters) {
            return errorResponse(res, `Counter creation blocked. Your plan allows up to ${allowedCounters} POS counters. Please upgrade your subscription limit first.`, 403);
        }
        // 2. Insert counter
        const [result] = await pool.execute('INSERT INTO pos_counters (branch_id, name) VALUES (?, ?)', [branch_id, name]);
        return successResponse(res, { counter_id: result.insertId, branch_id, name }, 'POS Counter created successfully');
    }
    catch (error) {
        console.error('Create Counter Error:', error);
        return errorResponse(res, 'Failed to create POS counter', 500, error);
    }
};
export const deleteCounter = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.execute('UPDATE pos_counters SET deleted_at = NOW() WHERE counter_id = ?', [id]);
        return successResponse(res, null, 'POS Counter deleted successfully');
    }
    catch (error) {
        console.error('Delete Counter Error:', error);
        return errorResponse(res, 'Failed to delete POS counter', 500, error);
    }
};
export const getActiveSession = async (req, res) => {
    const { branch_id } = req.query;
    if (!branch_id) {
        return errorResponse(res, 'branch_id is required', 400);
    }
    try {
        const [rows] = await pool.execute(`
      SELECT pcs.*, pc.name as counter_name
      FROM pos_counter_sessions pcs
      JOIN pos_counters pc ON pcs.counter_id = pc.counter_id
      WHERE pcs.branch_id = ? AND pcs.status = 'open'
      LIMIT 1
    `, [Number(branch_id)]);
        if (rows.length === 0) {
            return successResponse(res, null, 'No open session for this branch');
        }
        return successResponse(res, rows[0], 'Active counter session retrieved');
    }
    catch (error) {
        console.error('Get Active Session Error:', error);
        return errorResponse(res, 'Failed to fetch active session', 500, error);
    }
};
export const openSession = async (req, res) => {
    const { counter_id, branch_id, opening_balance } = req.body;
    const adminId = req.user?.admin_id;
    if (!counter_id || !branch_id) {
        return errorResponse(res, 'counter_id and branch_id are required', 400);
    }
    try {
        // Check if there is already an open session for this branch
        const [existing] = await pool.execute("SELECT * FROM pos_counter_sessions WHERE branch_id = ? AND status = 'open' LIMIT 1", [branch_id]);
        if (existing.length > 0) {
            return errorResponse(res, 'A counter session is already open for this branch. Please close it first.', 400);
        }
        const [result] = await pool.execute(`INSERT INTO pos_counter_sessions (counter_id, branch_id, opened_by, opening_balance, status)
       VALUES (?, ?, ?, ?, 'open')`, [counter_id, branch_id, adminId, opening_balance || 0]);
        return successResponse(res, { session_id: result.insertId }, 'POS Counter session opened successfully');
    }
    catch (error) {
        console.error('Open Session Error:', error);
        return errorResponse(res, 'Failed to open counter session', 500, error);
    }
};
export const getSessionSummary = async (req, res) => {
    const { id } = req.params;
    try {
        const [sessionRows] = await pool.execute(`SELECT pcs.*, pc.name as counter_name
       FROM pos_counter_sessions pcs
       JOIN pos_counters pc ON pcs.counter_id = pc.counter_id
       WHERE pcs.session_id = ?`, [id]);
        if (sessionRows.length === 0) {
            return errorResponse(res, 'Session not found', 404);
        }
        const session = sessionRows[0];
        const openedAt = session.opened_at;
        const closedAt = session.closed_at || new Date();
        const [salesRows] = await pool.execute(`SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(total_amount), 0) as total_sales
       FROM sales_orders
       WHERE branch_id = ? AND counter_id = ? AND created_at >= ? AND created_at <= ? AND deleted_at IS NULL`, [session.branch_id, session.counter_id, openedAt, closedAt]);
        const summary = salesRows[0];
        const openingBalance = Number(session.opening_balance);
        const expectedCash = openingBalance + Number(summary.cash_sales);
        return successResponse(res, {
            session,
            sales: {
                cash_sales: summary.cash_sales,
                card_sales: summary.card_sales,
                total_sales: summary.total_sales,
                opening_balance: openingBalance,
                expected_cash: expectedCash
            }
        });
    }
    catch (error) {
        console.error('Get Session Summary Error:', error);
        return errorResponse(res, 'Failed to retrieve session summary', 500, error);
    }
};
export const closeSession = async (req, res) => {
    const { session_id, closing_balance } = req.body;
    const adminId = req.user?.admin_id;
    if (!session_id) {
        return errorResponse(res, 'session_id is required', 400);
    }
    try {
        await pool.execute(`UPDATE pos_counter_sessions 
       SET status = 'closed', closed_by = ?, closed_at = NOW(), closing_balance = ?
       WHERE session_id = ?`, [adminId, closing_balance || 0, session_id]);
        return successResponse(res, null, 'Counter session closed successfully');
    }
    catch (error) {
        console.error('Close Session Error:', error);
        return errorResponse(res, 'Failed to close counter session', 500, error);
    }
};
