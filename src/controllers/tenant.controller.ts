import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';
import { provisionTenantDatabase } from '../config/initTenant';
import { v4 as uuidv4 } from 'uuid';

export const createTenant = async (req: Request, res: Response) => {
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
        const [result]: any = await pool.execute(
            `INSERT INTO tenants (name, contact_email, contact_phone, plan, db_name, status, plan_start_date, plan_end_date) 
             VALUES (?, ?, ?, ?, ?, 'Active', NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))`,
            [name, email, phone || null, plan || 'Basic', dbName]
        );

        return successResponse(res, {
            tenant_id: result.insertId,
            name,
            email,
            db_name: dbName
        }, 'Tenant created and provisioned successfully');
    } catch (error: any) {
        console.error('Tenant Creation Error:', error);
        return errorResponse(res, 'Failed to create tenant: ' + (error.message || String(error)), 500);
    }
};

export const updateTenant = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { 
        name, email, phone, plan, status, 
        plan_end_date,
        base_branches, base_counters, base_users,
        extra_branches, extra_counters, extra_users
    } = req.body;

    try {
        await pool.execute(
            `UPDATE tenants 
             SET name = ?, contact_email = ?, contact_phone = ?, plan = ?, status = ?,
                 plan_end_date = ?,
                 base_branches = ?, base_counters = ?, base_users = ?,
                 extra_branches = ?, extra_counters = ?, extra_users = ?
             WHERE tenant_id = ?`,
            [
                name, email, phone || null, plan, status,
                plan_end_date || null,
                base_branches || 1, base_counters || 1, base_users || 3,
                extra_branches || 0, extra_counters || 0, extra_users || 0,
                id
            ]
        );

        return successResponse(res, null, 'Tenant updated successfully');
    } catch (error: any) {
        console.error('Tenant Update Error:', error);
        return errorResponse(res, 'Failed to update tenant: ' + (error.message || String(error)), 500);
    }
};

export const getTenants = async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM tenants ORDER BY created_at DESC');
        
        const enrichedTenants = (rows as any[]).map(t => ({
            id: t.tenant_id,
            name: t.name,
            email: t.contact_email,
            phone: t.contact_phone,
            plan: t.plan,
            status: t.status,
            db_name: t.db_name,
            plan_start_date: t.plan_start_date,
            plan_end_date: t.plan_end_date,
            base_branches: t.base_branches,
            base_counters: t.base_counters,
            base_users: t.base_users,
            extra_branches: t.extra_branches,
            extra_counters: t.extra_counters,
            extra_users: t.extra_users,
            branches: (t.base_branches || 1) + (t.extra_branches || 0),
            counters: (t.base_counters || 1) + (t.extra_counters || 0),
            users: (t.base_users || 3) + (t.extra_users || 0),
            mrr: t.plan === 'Enterprise' ? 499 : (t.plan === 'Pro' ? 149 : 49)
        }));

        return successResponse(res, enrichedTenants, 'Tenants retrieved successfully');
    } catch (error: any) {
        console.error('Get Tenants Error:', error);
        return errorResponse(res, 'Failed to retrieve tenants', 500);
    }
};
