import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';
import { provisionTenantDatabase } from '../config/initTenant';
import { v4 as uuidv4 } from 'uuid';
export const createTenant = async (req, res) => {
    const { name, email, phone, plan, password } = req.body;
    if (!name || !email) {
        return errorResponse(res, 'Name and email are required', 400);
    }
    // Generate a database name based on the company name
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    // Append a 4-char random string to guarantee uniqueness in case of duplicate names
    const randomHash = uuidv4().replace(/-/g, '').substring(0, 4);
    const dbName = `kms_${sanitizedName}_${randomHash}`;
    try {
        // 1. Provision the database
        await provisionTenantDatabase(dbName, {
            name: name,
            email: email,
            username: email.split('@')[0],
            password: password || 'admin123' // Use custom password or fallback
        });
        // 2. Add to master tenants table
        const [result] = await pool.execute(`INSERT INTO tenants (name, contact_email, contact_phone, plan, db_name, status, plan_start_date, plan_end_date) 
             VALUES (?, ?, ?, ?, ?, 'Active', NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))`, [name, email, phone || null, plan || 'Basic', dbName]);
        return successResponse(res, {
            tenant_id: result.insertId,
            name,
            email,
            db_name: dbName
        }, 'Tenant created and provisioned successfully');
    }
    catch (error) {
        console.error('Tenant Creation Error:', error);
        return errorResponse(res, 'Failed to create tenant: ' + (error.message || String(error)), 500);
    }
};
export const updateTenant = async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, plan, status } = req.body;
    try {
        await pool.execute('UPDATE tenants SET name = ?, contact_email = ?, contact_phone = ?, plan = ?, status = ? WHERE tenant_id = ?', [name, email, phone || null, plan, status, id]);
        return successResponse(res, null, 'Tenant updated successfully');
    }
    catch (error) {
        console.error('Tenant Update Error:', error);
        return errorResponse(res, 'Failed to update tenant: ' + (error.message || String(error)), 500);
    }
};
export const getTenants = async (req, res) => {
    try {
        // We will optionally calculate MRR and Branch counts later, for now just return the tenants
        // We can do a basic join or subquery if we had global branch tracking, 
        // but branches are inside the tenant DBs! So we just return the master tenant rows.
        const [rows] = await pool.execute('SELECT * FROM tenants ORDER BY created_at DESC');
        // Mock branches and MRR for now based on plan
        const enrichedTenants = rows.map(t => ({
            id: t.tenant_id,
            name: t.name,
            email: t.contact_email,
            phone: t.contact_phone,
            plan: t.plan,
            status: t.status,
            db_name: t.db_name,
            branches: t.plan === 'Enterprise' ? 10 : (t.plan === 'Pro' ? 3 : 1),
            mrr: t.plan === 'Enterprise' ? 499 : (t.plan === 'Pro' ? 149 : 49)
        }));
        return successResponse(res, enrichedTenants, 'Tenants retrieved successfully');
    }
    catch (error) {
        console.error('Get Tenants Error:', error);
        return errorResponse(res, 'Failed to retrieve tenants', 500);
    }
};
