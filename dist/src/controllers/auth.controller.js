"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = exports.getAuditLogs = exports.deleteUser = exports.updateUser = exports.getUsers = exports.getProfile = exports.getRoles = exports.login = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const response_1 = require("../utils/response");
const jwt_1 = require("../utils/jwt");
const db_1 = __importStar(require("../config/db"));
const tenantContext_1 = require("../middleware/tenantContext");
const login = async (req, res) => {
    try {
        const { username, password, tenantId } = req.body;
        if (!username || !password) {
            return (0, response_1.errorResponse)(res, 'Username and password are required', 400);
        }
        let targetDb = 'kms_master';
        if (tenantId) {
            // Find the tenant database by ID, Name, DB Name, or Email
            const [tenantRows] = await db_1.default.execute('SELECT db_name FROM tenants WHERE (tenant_id = ? OR name = ? OR db_name = ? OR contact_email = ?) AND status = "Active"', [tenantId, tenantId, tenantId, tenantId]);
            if (!tenantRows || tenantRows.length === 0) {
                return (0, response_1.errorResponse)(res, 'Invalid Restaurant Code or inactive subscription', 401);
            }
            targetDb = tenantRows[0].db_name;
        }
        else {
            // Check master DB admins first to give super admins priority
            const [checkMaster] = await db_1.default.execute(`SELECT admin_id FROM admins WHERE (username = ? OR email = ?) AND deleted_at IS NULL AND status = 'active'`, [username, username]);
            if (checkMaster && checkMaster.length > 0) {
                targetDb = 'kms_master';
            }
            else {
                // Dynamic database discovery: Search tenants to see if the user's email belongs to one of them
                const [allTenants] = await db_1.default.execute('SELECT db_name FROM tenants WHERE status = "Active"');
                let foundDb = null;
                // Loop through tenant databases to find where this email exists as an admin
                for (const tenant of allTenants) {
                    try {
                        const [checkUser] = await db_1.default.execute(`SELECT admin_id FROM \`${tenant.db_name}\`.admins WHERE (username = ? OR email = ?) AND deleted_at IS NULL AND status = 'active'`, [username, username]);
                        if (checkUser && checkUser.length > 0) {
                            foundDb = tenant.db_name;
                            break;
                        }
                    }
                    catch (err) {
                        // Ignore if connection or table lookup fails for a specific tenant db
                    }
                }
                if (foundDb) {
                    targetDb = foundDb;
                }
                else {
                    return (0, response_1.errorResponse)(res, 'Invalid credentials or account inactive', 401);
                }
            }
        }
        console.log(`Attempting login for: ${username} on DB: ${targetDb}`);
        // Execute the login logic within the context of the target database
        tenantContext_1.tenantContext.run({ dbName: targetDb }, async () => {
            try {
                const [rows] = await db_1.default.execute(`SELECT a.*, r.role_name, r.display_name_en, r.display_name_ar, r.permissions 
           FROM admins a 
           LEFT JOIN roles r ON a.role_id = r.role_id 
           WHERE (a.username = ? OR a.email = ?) AND a.deleted_at IS NULL AND a.status = 'active'`, [username, username] // Check both fields with the same input
                );
                if (!rows || rows.length === 0) {
                    console.log('❌ LOGIN FAILED: User not found or inactive');
                    return (0, response_1.errorResponse)(res, 'Invalid credentials or account inactive', 401);
                }
                const admin = rows[0];
                console.log('✅ LOGIN SUCCESS: User found. Comparing passwords...');
                const isMatch = await bcryptjs_1.default.compare(password, admin.password);
                if (!isMatch) {
                    console.log('❌ LOGIN FAILED: Password mismatch');
                    return (0, response_1.errorResponse)(res, 'Invalid credentials', 401);
                }
                console.log('✅ PASSWORDS MATCH! Generating token for admin:', admin.admin_id);
                const token = (0, jwt_1.generateToken)({
                    admin_id: admin.admin_id,
                    username: admin.username,
                    role: admin.role_name || (admin.admin_id === 1 ? (targetDb === 'kms_master' ? 'super_admin' : 'tenant_admin') : 'user'),
                    display_name: admin.display_name_en || admin.first_name,
                    permissions: typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : (admin.permissions || []),
                    tenant_db: targetDb, // Store DB name in JWT
                    brand_id: admin.brand_id,
                    branch_id: admin.branch_id
                });
                await db_1.default.execute('INSERT INTO audit_logs (admin_id, action, entity_name, ip_address) VALUES (?, ?, ?, ?)', [admin.admin_id, 'LOGIN', 'auth', req.ip]);
                return (0, response_1.successResponse)(res, {
                    admin: {
                        admin_id: admin.admin_id,
                        username: admin.username,
                        role: admin.role_name || (admin.admin_id === 1 ? (targetDb === 'kms_master' ? 'super_admin' : 'tenant_admin') : 'user'),
                        firstName: admin.first_name,
                        lastName: admin.last_name,
                        permissions: typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : (admin.permissions || []),
                        isMaster: targetDb === 'kms_master',
                        brand_id: admin.brand_id,
                        branch_id: admin.branch_id
                    },
                    token,
                }, 'Login successful');
            }
            catch (error) {
                console.error('Login processing error inside context:', error);
                return (0, response_1.errorResponse)(res, 'Login failed during processing', 500, error);
            }
        }); // Close tenantContext.run
    }
    catch (error) {
        console.error('Login Error:', error);
        return (0, response_1.errorResponse)(res, 'Login failed: ' + (error.message || String(error)), 500, error);
    }
};
exports.login = login;
const getRoles = async (req, res) => {
    try {
        const [roles] = await db_1.default.execute('SELECT role_id, role_name, display_name_en, display_name_ar, permissions FROM roles WHERE deleted_at IS NULL');
        return (0, response_1.successResponse)(res, roles);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to fetch roles', 500, error);
    }
};
exports.getRoles = getRoles;
const getProfile = async (req, res) => {
    return (0, response_1.successResponse)(res, { admin: req.user });
};
exports.getProfile = getProfile;
const getUsers = async (req, res) => {
    try {
        const user = req.user;
        const isMaster = user?.tenant_db === 'kms_master';
        let query = `
      SELECT a.admin_id, a.username, a.email, a.first_name, a.last_name, a.status, a.role_id, a.branch_id, a.created_at, r.role_name, r.display_name_en, b.name_en as branch_name 
      FROM admins a 
      LEFT JOIN roles r ON a.role_id = r.role_id 
      LEFT JOIN branches b ON a.branch_id = b.branch_id
      WHERE a.deleted_at IS NULL
    `;
        const params = [];
        if (!isMaster) {
            query += ' AND a.admin_id != 1';
        }
        const [users] = await db_1.default.execute(query, params);
        return (0, response_1.successResponse)(res, users);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to fetch users', 500, error);
    }
};
exports.getUsers = getUsers;
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, email, username, password, role_id, branch_id, status } = req.body;
        if (password) {
            const hashedPassword = await bcryptjs_1.default.hash(password, 10);
            await db_1.default.execute('UPDATE admins SET first_name=?, last_name=?, email=?, username=?, password=?, role_id=?, branch_id=?, status=? WHERE admin_id=?', [first_name, last_name, email, username, hashedPassword, role_id || null, branch_id || null, status || 'active', id]);
        }
        else {
            await db_1.default.execute('UPDATE admins SET first_name=?, last_name=?, email=?, username=?, role_id=?, branch_id=?, status=? WHERE admin_id=?', [first_name, last_name, email, username, role_id || null, branch_id || null, status || 'active', id]);
        }
        return (0, response_1.successResponse)(res, null, 'User updated successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to update user', 500, error);
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (id === '1') {
            return (0, response_1.errorResponse)(res, 'Cannot delete the primary Super Admin account', 400);
        }
        await db_1.default.execute('UPDATE admins SET deleted_at=CURRENT_TIMESTAMP, status="inactive" WHERE admin_id=?', [id]);
        return (0, response_1.successResponse)(res, null, 'User deleted successfully');
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to delete user', 500, error);
    }
};
exports.deleteUser = deleteUser;
const getAuditLogs = async (req, res) => {
    try {
        const [logs] = await db_1.default.execute(`
      SELECT al.*, a.username 
      FROM audit_logs al 
      LEFT JOIN admins a ON al.admin_id = a.admin_id 
      ORDER BY al.created_at DESC 
      LIMIT 200
    `);
        return (0, response_1.successResponse)(res, logs);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to fetch audit logs', 500, error);
    }
};
exports.getAuditLogs = getAuditLogs;
const createUser = async (req, res) => {
    try {
        const { username, email, password, role_id, branch_id, first_name, last_name, status } = req.body;
        // Check subscription limits (exclude admin_id = 1 which is the tenant super admin account)
        const [countRows] = await db_1.default.execute('SELECT COUNT(*) as count FROM admins WHERE deleted_at IS NULL AND admin_id != 1');
        const currentCount = countRows[0].count;
        const dbName = req.user?.tenant_db;
        if (dbName && dbName !== 'kms_master') {
            const [tenantRows] = await db_1.masterPool.execute('SELECT base_users, extra_users FROM tenants WHERE db_name = ?', [dbName]);
            if (tenantRows && tenantRows.length > 0) {
                const limit = (tenantRows[0].base_users || 3) + (tenantRows[0].extra_users || 0);
                if (currentCount >= limit) {
                    return (0, response_1.errorResponse)(res, `User limit reached: Your current subscription allows a maximum of ${limit} users. Please upgrade your subscription limit first.`, 403);
                }
            }
        }
        // Check if exists
        const [existing] = await db_1.default.execute('SELECT admin_id FROM admins WHERE username = ? OR email = ?', [username, email]);
        if (existing.length > 0) {
            return (0, response_1.errorResponse)(res, 'Username or email already exists.', 400);
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const [result] = await db_1.default.execute('INSERT INTO admins (username, email, password, role_id, branch_id, first_name, last_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [username, email, hashedPassword, role_id, branch_id || null, first_name, last_name, status || 'active']);
        await db_1.default.execute('INSERT INTO audit_logs (admin_id, action, entity_name, entity_id) VALUES (?, ?, ?, ?)', [req.user?.admin_id || 1, 'USER_CREATED', 'Admin', result.insertId]);
        return (0, response_1.successResponse)(res, { admin_id: result.insertId }, 'User created successfully', 201);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to create user', 500, error);
    }
};
exports.createUser = createUser;
