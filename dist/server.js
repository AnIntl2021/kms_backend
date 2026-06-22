var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/config/config.ts
import dotenv from "dotenv";
import path from "path";
var env, envFile, config;
var init_config = __esm({
  "src/config/config.ts"() {
    "use strict";
    env = process.env.NODE_ENV || "development";
    envFile = `.env.${env}`;
    dotenv.config({ path: path.resolve(process.cwd(), envFile) });
    dotenv.config();
    config = {
      env,
      port: parseInt(process.env.PORT || "5000", 10),
      db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        name: process.env.DB_NAME
      },
      jwtSecret: process.env.JWT_SECRET || "fallback_secret",
      corsOrigin: process.env.CORS_ORIGIN || "*",
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID || "",
        keySecret: process.env.RAZORPAY_KEY_SECRET || ""
      }
    };
  }
});

// src/middleware/tenantContext.ts
import { AsyncLocalStorage } from "async_hooks";
var tenantContext;
var init_tenantContext = __esm({
  "src/middleware/tenantContext.ts"() {
    "use strict";
    tenantContext = new AsyncLocalStorage();
  }
});

// src/config/db.ts
import mysql from "mysql2/promise";
var dbConfig, poolCache, getPool, dynamicPoolProxy, masterPool, db_default;
var init_db = __esm({
  "src/config/db.ts"() {
    "use strict";
    init_config();
    init_tenantContext();
    dbConfig = {
      host: config.db.host,
      user: config.db.user,
      password: config.db.pass,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
    poolCache = /* @__PURE__ */ new Map();
    getPool = () => {
      const store = tenantContext.getStore();
      const dbName = store?.dbName || config.db.name;
      const safeDbName = dbName || "kms_master";
      if (!poolCache.has(safeDbName)) {
        console.log(`\u{1F50C} Initializing new connection pool for database: ${safeDbName}`);
        const newPool = mysql.createPool({
          ...dbConfig,
          database: safeDbName
        });
        newPool.on("connection", (connection) => {
          connection.query("SET time_zone = '+03:00'");
        });
        poolCache.set(safeDbName, newPool);
      }
      return poolCache.get(safeDbName);
    };
    dynamicPoolProxy = new Proxy({}, {
      get: (target, prop) => {
        const activePool = getPool();
        const value = activePool[prop];
        if (typeof value === "function") {
          return value.bind(activePool);
        }
        return value;
      }
    });
    masterPool = mysql.createPool({
      ...dbConfig,
      database: "kms_master"
    });
    db_default = dynamicPoolProxy;
  }
});

// src/utils/notifications.ts
var notifications_exports = {};
__export(notifications_exports, {
  checkAndNotifyLowStock: () => checkAndNotifyLowStock,
  sendNotification: () => sendNotification
});
var sendNotification, checkAndNotifyLowStock;
var init_notifications = __esm({
  "src/utils/notifications.ts"() {
    "use strict";
    init_db();
    sendNotification = async (message, type = "info") => {
      try {
        await db_default.execute(
          "INSERT INTO notifications (message, type) VALUES (?, ?)",
          [message, type]
        );
        console.log(`\u{1F514} Global Notification Sent: ${message}`);
      } catch (error) {
        console.error("Failed to send notification:", error);
      }
    };
    checkAndNotifyLowStock = async (itemId) => {
      try {
        const [rows] = await db_default.execute(
          "SELECT name_en, current_stock, min_stock_level FROM inventory_items WHERE inventory_item_id = ?",
          [itemId]
        );
        if (rows.length > 0) {
          const item = rows[0];
          if (Number(item.current_stock) <= Number(item.min_stock_level)) {
            const msg = `\u26A0\uFE0F LOW STOCK ALERT: ${item.name_en} is at ${item.current_stock}. (Threshold: ${item.min_stock_level})`;
            const [existing] = await db_default.execute(
              "SELECT notification_id FROM notifications WHERE message = ? AND is_read = FALSE",
              [msg]
            );
            if (existing.length === 0) {
              await sendNotification(msg, "warning");
            }
          }
        }
      } catch (error) {
        console.error("Low stock check failed:", error);
      }
    };
  }
});

// src/app.ts
init_config();
import express4 from "express";
import cors from "cors";
import path5 from "path";
import helmet from "helmet";
import morgan from "morgan";

// src/utils/response.ts
var successResponse = (res, data, message = "Success", status = 200) => {
  return res.status(status).json({
    success: true,
    message,
    data
  });
};
var errorResponse = (res, message = "Internal Server Error", status = 500, error = null) => {
  return res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error : void 0
  });
};

// src/routes/index.ts
import { Router as Router23 } from "express";

// src/routes/auth.routes.ts
import { Router } from "express";

// src/controllers/auth.controller.ts
import bcrypt from "bcryptjs";

// src/utils/jwt.ts
init_config();
import jwt from "jsonwebtoken";
var generateToken = (payload) => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "1d" });
};
var verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
};

// src/controllers/auth.controller.ts
init_db();
init_tenantContext();
var login = async (req, res) => {
  try {
    const { username, password, tenantId } = req.body;
    if (!username || !password) {
      return errorResponse(res, "Username and password are required", 400);
    }
    let targetDb = "kms_master";
    if (tenantId) {
      const [tenantRows] = await db_default.execute(
        'SELECT db_name FROM tenants WHERE (tenant_id = ? OR name = ? OR db_name = ? OR contact_email = ?) AND status = "Active"',
        [tenantId, tenantId, tenantId, tenantId]
      );
      if (!tenantRows || tenantRows.length === 0) {
        return errorResponse(res, "Invalid Restaurant Code or inactive subscription", 401);
      }
      targetDb = tenantRows[0].db_name;
    } else {
      const [checkMaster] = await db_default.execute(
        `SELECT admin_id FROM admins WHERE (username = ? OR email = ?) AND deleted_at IS NULL AND status = 'active'`,
        [username, username]
      );
      if (checkMaster && checkMaster.length > 0) {
        targetDb = "kms_master";
      } else {
        const [allTenants] = await db_default.execute('SELECT db_name FROM tenants WHERE status = "Active"');
        let foundDb = null;
        for (const tenant of allTenants) {
          try {
            const [checkUser] = await db_default.execute(
              `SELECT admin_id FROM \`${tenant.db_name}\`.admins WHERE (username = ? OR email = ?) AND deleted_at IS NULL AND status = 'active'`,
              [username, username]
            );
            if (checkUser && checkUser.length > 0) {
              foundDb = tenant.db_name;
              break;
            }
          } catch (err) {
          }
        }
        if (foundDb) {
          targetDb = foundDb;
        } else {
          return errorResponse(res, "Invalid credentials or account inactive", 401);
        }
      }
    }
    console.log(`Attempting login for: ${username} on DB: ${targetDb}`);
    tenantContext.run({ dbName: targetDb }, async () => {
      try {
        const [rows] = await db_default.execute(
          `SELECT a.*, r.role_name, r.display_name_en, r.display_name_ar, r.permissions 
           FROM admins a 
           LEFT JOIN roles r ON a.role_id = r.role_id 
           WHERE (a.username = ? OR a.email = ?) AND a.deleted_at IS NULL AND a.status = 'active'`,
          [username, username]
          // Check both fields with the same input
        );
        if (!rows || rows.length === 0) {
          console.log("\u274C LOGIN FAILED: User not found or inactive");
          return errorResponse(res, "Invalid credentials or account inactive", 401);
        }
        const admin = rows[0];
        console.log("\u2705 LOGIN SUCCESS: User found. Comparing passwords...");
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
          console.log("\u274C LOGIN FAILED: Password mismatch");
          return errorResponse(res, "Invalid credentials", 401);
        }
        console.log("\u2705 PASSWORDS MATCH! Generating token for admin:", admin.admin_id);
        const token = generateToken({
          admin_id: admin.admin_id,
          username: admin.username,
          role: admin.role_name || (admin.admin_id === 1 ? targetDb === "kms_master" ? "super_admin" : "tenant_admin" : "user"),
          display_name: admin.display_name_en || admin.first_name,
          permissions: typeof admin.permissions === "string" ? JSON.parse(admin.permissions) : admin.permissions || [],
          tenant_db: targetDb,
          // Store DB name in JWT
          brand_id: admin.brand_id,
          branch_id: admin.branch_id
        });
        await db_default.execute(
          "INSERT INTO audit_logs (admin_id, action, entity_name, ip_address) VALUES (?, ?, ?, ?)",
          [admin.admin_id, "LOGIN", "auth", req.ip]
        );
        return successResponse(res, {
          admin: {
            admin_id: admin.admin_id,
            username: admin.username,
            role: admin.role_name || (admin.admin_id === 1 ? targetDb === "kms_master" ? "super_admin" : "tenant_admin" : "user"),
            firstName: admin.first_name,
            lastName: admin.last_name,
            permissions: typeof admin.permissions === "string" ? JSON.parse(admin.permissions) : admin.permissions || [],
            isMaster: targetDb === "kms_master",
            brand_id: admin.brand_id,
            branch_id: admin.branch_id
          },
          token
        }, "Login successful");
      } catch (error) {
        console.error("Login processing error inside context:", error);
        return errorResponse(res, "Login failed during processing", 500, error);
      }
    });
  } catch (error) {
    console.error("Login Error:", error);
    return errorResponse(res, "Login failed: " + (error.message || String(error)), 500, error);
  }
};
var getRoles = async (req, res) => {
  try {
    const [roles] = await db_default.execute("SELECT role_id, role_name, display_name_en, display_name_ar, permissions FROM roles WHERE deleted_at IS NULL");
    return successResponse(res, roles);
  } catch (error) {
    return errorResponse(res, "Failed to fetch roles", 500, error);
  }
};
var getProfile = async (req, res) => {
  return successResponse(res, { admin: req.user });
};
var getUsers = async (req, res) => {
  try {
    const user = req.user;
    const isMaster = user?.tenant_db === "kms_master";
    let query = `
      SELECT a.admin_id, a.username, a.email, a.first_name, a.last_name, a.status, a.role_id, a.branch_id, a.created_at, r.role_name, r.display_name_en, b.name_en as branch_name 
      FROM admins a 
      LEFT JOIN roles r ON a.role_id = r.role_id 
      LEFT JOIN branches b ON a.branch_id = b.branch_id
      WHERE a.deleted_at IS NULL
    `;
    const params = [];
    if (!isMaster) {
      query += " AND a.admin_id != 1";
    }
    const [users] = await db_default.execute(query, params);
    return successResponse(res, users);
  } catch (error) {
    return errorResponse(res, "Failed to fetch users", 500, error);
  }
};
var updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, username, password, role_id, branch_id, status } = req.body;
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db_default.execute(
        "UPDATE admins SET first_name=?, last_name=?, email=?, username=?, password=?, role_id=?, branch_id=?, status=? WHERE admin_id=?",
        [first_name, last_name, email, username, hashedPassword, role_id || null, branch_id || null, status || "active", id]
      );
    } else {
      await db_default.execute(
        "UPDATE admins SET first_name=?, last_name=?, email=?, username=?, role_id=?, branch_id=?, status=? WHERE admin_id=?",
        [first_name, last_name, email, username, role_id || null, branch_id || null, status || "active", id]
      );
    }
    return successResponse(res, null, "User updated successfully");
  } catch (error) {
    return errorResponse(res, "Failed to update user", 500, error);
  }
};
var deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === "1") {
      return errorResponse(res, "Cannot delete the primary Super Admin account", 400);
    }
    await db_default.execute('UPDATE admins SET deleted_at=CURRENT_TIMESTAMP, status="inactive" WHERE admin_id=?', [id]);
    return successResponse(res, null, "User deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete user", 500, error);
  }
};
var getAuditLogs = async (req, res) => {
  try {
    const [logs] = await db_default.execute(`
      SELECT al.*, a.username 
      FROM audit_logs al 
      LEFT JOIN admins a ON al.admin_id = a.admin_id 
      ORDER BY al.created_at DESC 
      LIMIT 200
    `);
    return successResponse(res, logs);
  } catch (error) {
    return errorResponse(res, "Failed to fetch audit logs", 500, error);
  }
};
var createUser = async (req, res) => {
  try {
    const { username, email, password, role_id, branch_id, first_name, last_name, status } = req.body;
    const [countRows] = await db_default.execute("SELECT COUNT(*) as count FROM admins WHERE deleted_at IS NULL");
    const currentCount = countRows[0].count;
    const dbName = req.user?.tenant_db;
    if (dbName && dbName !== "kms_master") {
      const [tenantRows] = await masterPool.execute(
        "SELECT base_users, extra_users FROM tenants WHERE db_name = ?",
        [dbName]
      );
      if (tenantRows && tenantRows.length > 0) {
        const limit = (tenantRows[0].base_users || 3) + (tenantRows[0].extra_users || 0);
        if (currentCount >= limit) {
          return errorResponse(res, `User limit reached: Your current subscription allows a maximum of ${limit} users. Please upgrade your subscription limit first.`, 403);
        }
      }
    }
    const [existing] = await db_default.execute("SELECT admin_id FROM admins WHERE username = ? OR email = ?", [username, email]);
    if (existing.length > 0) {
      return errorResponse(res, "Username or email already exists.", 400);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db_default.execute(
      "INSERT INTO admins (username, email, password, role_id, branch_id, first_name, last_name, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [username, email, hashedPassword, role_id, branch_id || null, first_name, last_name, status || "active"]
    );
    await db_default.execute(
      "INSERT INTO audit_logs (admin_id, action, entity_name, entity_id) VALUES (?, ?, ?, ?)",
      [req.user?.admin_id || 1, "USER_CREATED", "Admin", result.insertId]
    );
    return successResponse(res, { admin_id: result.insertId }, "User created successfully", 201);
  } catch (error) {
    return errorResponse(res, "Failed to create user", 500, error);
  }
};

// src/controllers/roles.controller.ts
init_db();
var createRole = async (req, res) => {
  try {
    const { role_name, display_name_en, display_name_ar, permissions } = req.body;
    const [existing] = await db_default.execute("SELECT role_id FROM roles WHERE role_name = ?", [role_name]);
    if (existing.length > 0) return errorResponse(res, "Role name already exists", 400);
    const permsJson = JSON.stringify(permissions || []);
    const [result] = await db_default.execute(
      "INSERT INTO roles (role_name, display_name_en, display_name_ar, permissions) VALUES (?, ?, ?, ?)",
      [role_name, display_name_en, display_name_ar || display_name_en, permsJson]
    );
    return successResponse(res, { role_id: result.insertId }, "Role created successfully", 201);
  } catch (error) {
    console.error("Create Role Error:", error);
    return errorResponse(res, `Failed to create role: ${error.message || "Unknown error"}`, 500, error);
  }
};
var updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_name, display_name_en, display_name_ar, permissions } = req.body;
    const permsJson = JSON.stringify(permissions || []);
    await db_default.execute(
      "UPDATE roles SET role_name=?, display_name_en=?, display_name_ar=?, permissions=? WHERE role_id=?",
      [role_name, display_name_en, display_name_ar || display_name_en, permsJson, id]
    );
    return successResponse(res, null, "Role updated successfully");
  } catch (error) {
    return errorResponse(res, "Failed to update role", 500, error);
  }
};
var deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const [users] = await db_default.execute("SELECT admin_id FROM admins WHERE role_id = ? AND deleted_at IS NULL", [id]);
    if (users.length > 0) return errorResponse(res, "Cannot delete role as it is assigned to active users", 400);
    await db_default.execute("UPDATE roles SET deleted_at=CURRENT_TIMESTAMP WHERE role_id=?", [id]);
    return successResponse(res, null, "Role deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete role", 500, error);
  }
};

// src/middleware/auth.middleware.ts
init_tenantContext();
var authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, "Authentication required", 401);
  }
  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return errorResponse(res, "Invalid or expired token", 401);
  }
  req.user = decoded;
  tenantContext.run({ dbName: decoded.tenant_db || "kms_master" }, () => {
    next();
  });
};
var authorize = (allowedRolesOrPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, "Access denied: not authenticated", 403);
    }
    console.log("\u{1F512} AUTH DEBUGLOG:", {
      userRole: req.user.role,
      userPermissions: req.user.permissions,
      required: allowedRolesOrPermissions
    });
    const hasRole = allowedRolesOrPermissions.includes(req.user.role);
    const userPermissions = req.user.permissions || [];
    const hasPermission = allowedRolesOrPermissions.some((perm) => userPermissions.includes(perm));
    if (!hasRole && !hasPermission && req.user.role !== "super_admin" && req.user.role !== "tenant_admin") {
      return errorResponse(res, "Access denied: insufficient permissions", 403);
    }
    next();
  };
};
var restoreTenantContext = (req, res, next) => {
  if (req.user && req.user.tenant_db) {
    tenantContext.run({ dbName: req.user.tenant_db }, () => {
      next();
    });
  } else {
    next();
  }
};

// src/routes/auth.routes.ts
var router = Router();
router.post("/login", login);
router.get("/profile", authMiddleware, getProfile);
router.get("/roles", authMiddleware, authorize(["super_admin", "manager", "roles"]), getRoles);
router.post("/roles", authMiddleware, authorize(["super_admin", "manager", "roles"]), createRole);
router.put("/roles/:id", authMiddleware, authorize(["super_admin", "manager", "roles"]), updateRole);
router.delete("/roles/:id", authMiddleware, authorize(["super_admin", "manager", "roles"]), deleteRole);
router.get("/users", authMiddleware, authorize(["super_admin", "manager", "users"]), getUsers);
router.post("/users", authMiddleware, authorize(["super_admin", "manager", "users"]), createUser);
router.put("/users/:id", authMiddleware, authorize(["super_admin", "manager", "users"]), updateUser);
router.delete("/users/:id", authMiddleware, authorize(["super_admin", "manager", "users"]), deleteUser);
var auth_routes_default = router;

// src/routes/business.routes.ts
import { Router as Router2 } from "express";

// src/controllers/product.controller.ts
init_db();

// src/utils/audit.ts
init_db();
var logAudit = async (adminId, action, entityName, entityId = null, oldValues = null, newValues = null, req = null) => {
  try {
    const ipAddress = req ? req.ip : null;
    const userAgent = req ? req.get("user-agent") : null;
    await db_default.execute(
      `INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        adminId,
        action,
        entityName,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error("Audit Log Error:", error);
  }
};

// src/controllers/product.controller.ts
var getProducts = async (req, res) => {
  try {
    const { category_id, sort = "sort_order", order = "ASC" } = req.query;
    let query = `
      SELECT p.*, c.name_en as category_name_en, c.name_ar as category_name_ar 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.category_id 
      WHERE p.deleted_at IS NULL
    `;
    const params = [];
    if (category_id) {
      query += " AND p.category_id = ?";
      params.push(category_id);
    }
    query += ` ORDER BY ${sort} ${order === "DESC" ? "DESC" : "ASC"}`;
    const [products] = await db_default.execute(query, params);
    return successResponse(res, products);
  } catch (error) {
    return errorResponse(res, "Failed to fetch products", 500, error);
  }
};
var createProduct = async (req, res) => {
  try {
    const { name_en, name_ar, category_id, base_price, sku, sort_order } = req.body;
    const [result] = await db_default.execute(
      `INSERT INTO products (name_en, name_ar, category_id, base_price, sku, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name_en, name_ar, category_id, base_price, sku, sort_order || 0]
    );
    const productId = result.insertId;
    await logAudit(req.user.admin_id, "CREATE_PRODUCT", "products", productId, null, req.body, req);
    return successResponse(res, { product_id: productId }, "Product created successfully", 201);
  } catch (error) {
    return errorResponse(res, "Failed to create product", 500, error);
  }
};
var updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_en, name_ar, base_price, sort_order } = req.body;
    const [oldRows] = await db_default.execute("SELECT * FROM products WHERE product_id = ?", [id]);
    const oldData = oldRows[0];
    await db_default.execute(
      `UPDATE products 
       SET name_en = ?, name_ar = ?, base_price = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE product_id = ?`,
      [name_en, name_ar, base_price, sort_order, id]
    );
    await logAudit(req.user.admin_id, "UPDATE_PRODUCT", "products", parseInt(id), oldData, req.body, req);
    return successResponse(res, null, "Product updated successfully");
  } catch (error) {
    return errorResponse(res, "Failed to update product", 500, error);
  }
};
var deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await db_default.execute(
      "UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE product_id = ?",
      [id]
    );
    await logAudit(req.user.admin_id, "DELETE_PRODUCT", "products", parseInt(id), { status: "active" }, { status: "deleted" }, req);
    return successResponse(res, null, "Product deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete product", 500, error);
  }
};

// src/controllers/settings.controller.ts
init_db();

// src/utils/backup.ts
init_config();
import { exec } from "child_process";
import path2 from "path";
import fs from "fs";
import { promisify } from "util";
var execPromise = promisify(exec);
var BACKUP_DIR = path2.join(process.cwd(), "backups");
var MAX_BACKUPS = 7;
async function runBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const fileName = `kms_backup_${timestamp}.sql`;
    const filePath = path2.join(BACKUP_DIR, fileName);
    const host = config.db.host || "localhost";
    const user = config.db.user || "root";
    const password = config.db.pass || "";
    const dbName = config.db.name || "kms_master";
    const passPart = password ? `-p${password}` : "";
    const command = `mysqldump -h ${host} -u ${user} ${passPart} ${dbName} > "${filePath}"`;
    console.log(`\u{1F680} Starting database backup for ${dbName}...`);
    await execPromise(command);
    console.log(`\u2705 Backup created: ${fileName}`);
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".sql")).map((f) => ({ name: f, time: fs.statSync(path2.join(BACKUP_DIR, f)).mtime.getTime() })).sort((a, b) => b.time - a.time);
    if (files.length > MAX_BACKUPS) {
      const filesToDelete = files.slice(MAX_BACKUPS);
      for (const file of filesToDelete) {
        fs.unlinkSync(path2.join(BACKUP_DIR, file.name));
        console.log(`\u{1F5D1}\uFE0F Deleted old backup: ${file.name}`);
      }
    }
    return { success: true, file: fileName };
  } catch (error) {
    console.error("\u274C Backup failed:", error);
    return { success: false, error };
  }
}

// src/controllers/settings.controller.ts
init_tenantContext();
var getSettings = async (req, res) => {
  try {
    let targetDb = "kms_master";
    const tenantIdParam = req.query.tenant || req.headers["x-tenant-id"];
    if (tenantIdParam) {
      const [tenants] = await db_default.execute("SELECT db_name FROM tenants WHERE tenant_id = ? OR name = ?", [tenantIdParam, tenantIdParam]);
      if (tenants.length > 0) {
        targetDb = tenants[0].db_name;
      }
    } else {
      const currentDb = tenantContext.getStore()?.dbName;
      if (currentDb) targetDb = currentDb;
    }
    await tenantContext.run({ dbName: targetDb }, async () => {
      const [settings] = await db_default.execute("SELECT * FROM system_settings");
      const settingsObj = settings.reduce((acc, curr) => {
        acc[curr.setting_key] = curr.setting_value;
        return acc;
      }, {});
      let tenantPlan = "Basic";
      let companyName = "";
      if (targetDb && targetDb !== "kms_master") {
        await tenantContext.run({ dbName: "kms_master" }, async () => {
          const [tenantRows] = await db_default.execute("SELECT plan, name FROM tenants WHERE db_name = ?", [targetDb]);
          if (tenantRows && tenantRows.length > 0) {
            tenantPlan = tenantRows[0].plan;
            companyName = tenantRows[0].name;
          }
        });
        if (companyName) {
          settingsObj.company_name = companyName;
          await db_default.execute(
            "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
            ["company_name", companyName, companyName]
          );
          if (!settingsObj.receipt_header) {
            settingsObj.receipt_header = companyName;
            await db_default.execute(
              "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
              ["receipt_header", companyName, companyName]
            );
          }
        }
      }
      if (!settingsObj.receipt_footer) {
        settingsObj.receipt_footer = "Thank you for your visit!\nPlease come again.";
        await db_default.execute(
          "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
          ["receipt_footer", settingsObj.receipt_footer, settingsObj.receipt_footer]
        );
      }
      settingsObj.subscription_plan = tenantPlan;
      return successResponse(res, settingsObj);
    });
  } catch (error) {
    console.error("GetSettings Error:", error);
    return errorResponse(res, "Failed to fetch settings", 500, error);
  }
};
var updateSettings = async (req, res) => {
  try {
    const settings = req.body;
    const queries = Object.keys(settings).map((key) => {
      return db_default.execute(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?",
        [key, settings[key], settings[key]]
      );
    });
    await Promise.all(queries);
    return successResponse(res, null, "Settings updated successfully");
  } catch (error) {
    console.error("UpdateSettings Error:", error);
    return errorResponse(res, "Failed to update settings", 500, error);
  }
};
var triggerBackup = async (req, res) => {
  const result = await runBackup();
  if (result.success) {
    return successResponse(res, { file: result.file }, "Backup created and rotated successfully");
  } else {
    return errorResponse(res, "Backup failed", 500, result.error);
  }
};

// src/controllers/category.controller.ts
init_db();
var getCategories = async (req, res) => {
  try {
    const { parent_only } = req.query;
    let query = "SELECT * FROM categories WHERE deleted_at IS NULL";
    const params = [];
    if (parent_only === "true") {
      query += " AND parent_id IS NULL";
    }
    query += " ORDER BY sort_order ASC, name_en ASC";
    const [categories] = await db_default.execute(query, params);
    return successResponse(res, categories);
  } catch (error) {
    return errorResponse(res, "Failed to fetch categories", 500, error);
  }
};
var createCategory = async (req, res) => {
  try {
    const { name_en, name_ar, sort_order, parent_id } = req.body;
    const [result] = await db_default.execute(
      "INSERT INTO categories (name_en, name_ar, sort_order, parent_id) VALUES (?, ?, ?, ?)",
      [name_en, name_ar, sort_order || 0, parent_id || null]
    );
    return successResponse(res, { category_id: result.insertId }, "Category created successfully", 201);
  } catch (error) {
    return errorResponse(res, "Failed to create category", 500, error);
  }
};
var updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_en, name_ar, sort_order, parent_id } = req.body;
    await db_default.execute(
      "UPDATE categories SET name_en = ?, name_ar = ?, sort_order = ?, parent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE category_id = ?",
      [name_en, name_ar, sort_order, parent_id || null, id]
    );
    return successResponse(res, null, "Category updated successfully");
  } catch (error) {
    return errorResponse(res, "Failed to update category", 500, error);
  }
};
var deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await db_default.execute("UPDATE categories SET deleted_at = CURRENT_TIMESTAMP WHERE category_id = ?", [id]);
    return successResponse(res, null, "Category deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete category", 500, error);
  }
};

// src/routes/business.routes.ts
var router2 = Router2();
router2.get("/products", authMiddleware, getProducts);
router2.post("/products", authMiddleware, authorize(["super_admin", "inventory_controller"]), createProduct);
router2.put("/products/:id", authMiddleware, authorize(["super_admin", "inventory_controller"]), updateProduct);
router2.delete("/products/:id", authMiddleware, authorize(["super_admin", "inventory_controller"]), deleteProduct);
router2.get("/categories", authMiddleware, getCategories);
router2.post("/categories", authMiddleware, authorize(["super_admin", "manager"]), createCategory);
router2.put("/categories/:id", authMiddleware, authorize(["super_admin"]), updateCategory);
router2.delete("/categories/:id", authMiddleware, authorize(["super_admin"]), deleteCategory);
router2.get("/settings", getSettings);
router2.put("/settings", authMiddleware, authorize(["super_admin"]), updateSettings);
router2.get("/audit-logs", authMiddleware, authorize(["super_admin"]), getAuditLogs);
var business_routes_default = router2;

// src/routes/inventory.routes.ts
import { Router as Router3 } from "express";

// src/controllers/inventory.controller.ts
init_db();
var getInventoryItems = async (req, res) => {
  try {
    const user = req.user;
    const { category_id, search } = req.query;
    let query = `
      SELECT i.*, c.name_en as category_name_en, c.name_ar as category_name_ar,
      (SELECT cost_per_unit FROM inventory_batches WHERE inventory_item_id = i.inventory_item_id AND status = 'active' ORDER BY created_at ASC LIMIT 1) as dynamic_cost_price
      FROM inventory_items i 
      LEFT JOIN categories c ON i.category_id = c.category_id 
      WHERE i.deleted_at IS NULL
    `;
    const params = [];
    if (category_id) {
      query += " AND i.category_id = ?";
      params.push(category_id);
    }
    if (search) {
      query += " AND (i.name_en LIKE ? OR i.name_ar LIKE ? OR i.sku LIKE ?)";
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    if (user && user.brand_id) {
      query += " AND i.brand_id = ?";
      params.push(user.brand_id);
    } else if (req.query.brand_id) {
      query += " AND i.brand_id = ?";
      params.push(req.query.brand_id);
    }
    query += " ORDER BY i.sort_order ASC, i.name_en ASC";
    const [items] = await db_default.execute(query, params);
    return successResponse(res, items);
  } catch (error) {
    return errorResponse(res, "Failed to fetch inventory items", 500, error);
  }
};
var createInventoryItem = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const user = req.user;
    const { name_en, name_ar, sku, category_id, current_stock, min_stock_level, unit_en, unit_ar, cost_price, sort_order, packages } = req.body;
    let brandId = req.body.brand_id || null;
    if (user && user.brand_id) {
      brandId = user.brand_id;
    }
    const [result] = await connection.execute(
      `INSERT INTO inventory_items (name_en, name_ar, sku, category_id, current_stock, min_stock_level, unit_en, unit_ar, cost_price, sort_order, brand_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name_en, name_ar, sku, category_id, current_stock || 0, min_stock_level || 5, unit_en || "kg", unit_ar || "\u0643\u062C\u0645", cost_price || 0, sort_order || 0, brandId]
    );
    const itemId = result.insertId;
    if (packages && Array.isArray(packages)) {
      for (const pkg of packages) {
        await connection.execute(
          `INSERT INTO inventory_item_packages (inventory_item_id, name_en, name_ar, multiplier, parent_name, base_price) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [itemId, pkg.name_en, pkg.name_en, pkg.multiplier || 1, pkg.parent_name || null, cost_price || 0]
        );
      }
    }
    await connection.commit();
    await logAudit(req.user.admin_id, "CREATE_INVENTORY_ITEM", "inventory_items", itemId, null, req.body, req);
    return successResponse(res, { inventory_item_id: itemId }, "Inventory item created successfully", 201);
  } catch (error) {
    await connection.rollback();
    if (error.code === "ER_DUP_ENTRY") {
      return errorResponse(res, "SKU already exists", 400);
    }
    return errorResponse(res, "Failed to create inventory item", 500, error);
  } finally {
    connection.release();
  }
};
var updateInventoryItem = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { name_en, name_ar, sku, category_id, min_stock_level, unit_en, unit_ar, cost_price, sort_order, packages } = req.body;
    const [oldRows] = await connection.execute("SELECT * FROM inventory_items WHERE inventory_item_id = ?", [id]);
    if (oldRows.length === 0) {
      return errorResponse(res, "Inventory item not found", 404);
    }
    const oldData = oldRows[0];
    await connection.execute(
      `UPDATE inventory_items 
       SET name_en = ?, name_ar = ?, sku = ?, category_id = ?, min_stock_level = ?, unit_en = ?, unit_ar = ?, cost_price = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE inventory_item_id = ?`,
      [
        name_en || oldData.name_en,
        name_ar || oldData.name_ar,
        sku || oldData.sku,
        category_id || oldData.category_id,
        min_stock_level !== void 0 ? min_stock_level : oldData.min_stock_level,
        unit_en || oldData.unit_en,
        unit_ar || oldData.unit_ar,
        cost_price !== void 0 ? cost_price : oldData.cost_price,
        sort_order !== void 0 ? sort_order : oldData.sort_order,
        id
      ]
    );
    if (packages && Array.isArray(packages)) {
      const [currentPkgsRows] = await connection.execute("SELECT package_id FROM inventory_item_packages WHERE inventory_item_id = ? AND deleted_at IS NULL", [id]);
      const currentPkgIdsInDB = currentPkgsRows.map((r) => r.package_id);
      const payloadPkgIds = packages.filter((p) => p.id).map((p) => p.id);
      const idsToDelete = currentPkgIdsInDB.filter((idInDB) => !payloadPkgIds.includes(idInDB));
      if (idsToDelete.length > 0) {
        await connection.execute(
          `UPDATE inventory_item_packages SET deleted_at = CURRENT_TIMESTAMP WHERE package_id IN (${idsToDelete.join(",")})`
        );
      }
      for (const pkg of packages) {
        if (pkg.id) {
          await connection.execute(
            `UPDATE inventory_item_packages SET name_en = ?, name_ar = ?, multiplier = ?, parent_name = ?, base_price = ?, updated_at = CURRENT_TIMESTAMP WHERE package_id = ?`,
            [pkg.name_en, pkg.name_en, pkg.multiplier || 1, pkg.parent_name || null, cost_price || 0, pkg.id]
          );
        } else {
          await connection.execute(
            `INSERT INTO inventory_item_packages (inventory_item_id, name_en, name_ar, multiplier, parent_name, base_price) VALUES (?, ?, ?, ?, ?, ?)`,
            [id, pkg.name_en, pkg.name_en, pkg.multiplier || 1, pkg.parent_name || null, cost_price || 0]
          );
        }
      }
    }
    await connection.commit();
    await logAudit(req.user.admin_id, "UPDATE_INVENTORY_ITEM", "inventory_items", parseInt(id), oldData, req.body, req);
    return successResponse(res, null, "Inventory item updated successfully");
  } catch (error) {
    await connection.rollback();
    console.error("Update Inventory Error:", error);
    return errorResponse(res, "Failed to update inventory item", 500, error);
  } finally {
    connection.release();
  }
};
var deleteInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    await db_default.execute(
      "UPDATE inventory_items SET deleted_at = CURRENT_TIMESTAMP WHERE inventory_item_id = ?",
      [id]
    );
    await logAudit(req.user.admin_id, "DELETE_INVENTORY_ITEM", "inventory_items", parseInt(id), { status: "active" }, { status: "deleted" }, req);
    return successResponse(res, null, "Inventory item deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete inventory item", 500, error);
  }
};
var adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment_type, quantity, reason } = req.body;
    const [rows] = await db_default.execute("SELECT current_stock FROM inventory_items WHERE inventory_item_id = ?", [id]);
    if (rows.length === 0) {
      return errorResponse(res, "Inventory item not found", 404);
    }
    const currentStock = parseFloat(rows[0].current_stock);
    const adjustQty = parseFloat(quantity);
    const newStock = adjustment_type === "add" ? currentStock + adjustQty : currentStock - adjustQty;
    await db_default.execute(
      "UPDATE inventory_items SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE inventory_item_id = ?",
      [newStock, id]
    );
    Promise.resolve().then(() => (init_notifications(), notifications_exports)).then((m) => m.checkAndNotifyLowStock(Number(id)));
    await logAudit(req.user.admin_id, "STOCK_ADJUSTMENT", "inventory_items", parseInt(id), { old_stock: currentStock }, { new_stock: newStock, type: adjustment_type, reason }, req);
    return successResponse(res, { new_stock: newStock }, "Stock adjusted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to adjust stock", 500, error);
  }
};
var getInventoryPackages = async (req, res) => {
  try {
    const { inventory_item_id } = req.query;
    let query = "SELECT * FROM inventory_item_packages WHERE deleted_at IS NULL";
    const params = [];
    if (inventory_item_id) {
      query += " AND inventory_item_id = ?";
      params.push(inventory_item_id);
    }
    const [packages] = await db_default.execute(query, params);
    return successResponse(res, packages);
  } catch (error) {
    return errorResponse(res, "Failed to fetch inventory packages", 500, error);
  }
};

// src/routes/inventory.routes.ts
var router3 = Router3();
router3.use(authMiddleware);
router3.get("/", getInventoryItems);
router3.get("/packages", getInventoryPackages);
router3.post("/", createInventoryItem);
router3.put("/:id", updateInventoryItem);
router3.delete("/:id", deleteInventoryItem);
router3.post("/:id/adjust-stock", adjustStock);
var inventory_routes_default = router3;

// src/routes/vendor.routes.ts
import { Router as Router4 } from "express";

// src/controllers/vendor.controller.ts
init_db();
var getVendors = async (req, res) => {
  try {
    const [vendors] = await db_default.execute("SELECT * FROM vendors WHERE deleted_at IS NULL ORDER BY name_en ASC");
    for (const vendor of vendors) {
      const [branches] = await db_default.execute('SELECT * FROM partner_branches WHERE partner_id = ? AND status = "active"', [vendor.vendor_id]);
      vendor.branches = branches;
    }
    return successResponse(res, vendors);
  } catch (error) {
    return errorResponse(res, "Failed to fetch partners", 500, error);
  }
};
var createVendor = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { name_en, name_ar, contact_person, phone, email, address, type, status, default_discount, branches } = req.body;
    const [result] = await connection.execute(
      "INSERT INTO vendors (name_en, name_ar, contact_person, phone, email, address, type, status, default_discount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [name_en, name_ar, contact_person, phone, email, address, type || "supplier", status || "active", default_discount || 0]
    );
    const partnerId = result.insertId;
    if (branches && Array.isArray(branches)) {
      for (const br of branches) {
        await connection.execute(
          "INSERT INTO partner_branches (partner_id, name_en, name_ar, address, contact_person, phone) VALUES (?, ?, ?, ?, ?, ?)",
          [partnerId, br.name_en, br.name_ar || br.name_en, br.address || address, br.contact_person || contact_person, br.phone || phone]
        );
      }
    }
    await connection.commit();
    return successResponse(res, { vendor_id: partnerId }, "Partner & Branches registered successfully", 201);
  } catch (error) {
    await connection.rollback();
    console.error("Create Vendor Error:", error);
    return errorResponse(res, "Failed to register partner network", 500, error);
  } finally {
    connection.release();
  }
};
var updateVendor = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { name_en, name_ar, contact_person, phone, email, address, status, type, default_discount, branches } = req.body;
    await connection.execute(
      "UPDATE vendors SET name_en = ?, name_ar = ?, contact_person = ?, phone = ?, email = ?, address = ?, status = ?, type = ?, default_discount = ? WHERE vendor_id = ?",
      [name_en, name_ar, contact_person, phone, email, address, status, type, default_discount || 0, id]
    );
    if (branches && Array.isArray(branches)) {
      const incomingBranchIds = branches.map((br) => br.branch_id).filter((id2) => id2);
      if (incomingBranchIds.length > 0) {
        await connection.execute(
          `DELETE FROM partner_branches WHERE partner_id = ? AND branch_id NOT IN (${incomingBranchIds.map(() => "?").join(",")})`,
          [id, ...incomingBranchIds]
        );
      } else {
        await connection.execute("DELETE FROM partner_branches WHERE partner_id = ?", [id]);
      }
      for (const br of branches) {
        if (br.branch_id) {
          await connection.execute(
            "UPDATE partner_branches SET name_en = ?, name_ar = ?, address = ?, contact_person = ?, phone = ? WHERE branch_id = ? AND partner_id = ?",
            [br.name_en, br.name_ar || br.name_en, br.address || address, br.contact_person || contact_person, br.phone || phone, br.branch_id, id]
          );
        } else {
          await connection.execute(
            "INSERT INTO partner_branches (partner_id, name_en, name_ar, address, contact_person, phone) VALUES (?, ?, ?, ?, ?, ?)",
            [id, br.name_en, br.name_ar || br.name_en, br.address || address, br.contact_person || contact_person, br.phone || phone]
          );
        }
      }
    }
    await connection.commit();
    return successResponse(res, null, "Partner project updated successfully");
  } catch (error) {
    await connection.rollback();
    console.error("Update Vendor Error:", error);
    return errorResponse(res, "Failed to update distribution network", 500, error);
  } finally {
    connection.release();
  }
};
var deleteVendor = async (req, res) => {
  try {
    const { id } = req.params;
    await db_default.execute("UPDATE vendors SET deleted_at = CURRENT_TIMESTAMP WHERE vendor_id = ?", [id]);
    return successResponse(res, null, "Partner removed successfully");
  } catch (error) {
    return errorResponse(res, "Failed to remove partner", 500, error);
  }
};

// src/routes/vendor.routes.ts
var router4 = Router4();
router4.use(authMiddleware);
router4.get("/", getVendors);
router4.post("/", authorize(["super_admin", "manager"]), createVendor);
router4.put("/:id", authorize(["super_admin"]), updateVendor);
router4.delete("/:id", authorize(["super_admin"]), deleteVendor);
var vendor_routes_default = router4;

// src/routes/purchase.routes.ts
import { Router as Router5 } from "express";

// src/controllers/purchase.controller.ts
init_db();
var getPurchaseOrders = async (req, res) => {
  try {
    const [orders] = await db_default.execute(`
      SELECT po.*, v.name_en as vendor_name, pb.name_en as branch_name
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON po.branch_id = pb.branch_id
      WHERE po.deleted_at IS NULL 
      ORDER BY po.created_at DESC
    `);
    return successResponse(res, orders);
  } catch (error) {
    return errorResponse(res, "Failed to fetch purchase orders", 500, error);
  }
};
var getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const [orders] = await db_default.execute(`
      SELECT po.*, v.name_en as vendor_name, v.name_ar as vendor_name_ar, pb.name_en as branch_name
      FROM purchase_orders po
      JOIN vendors v ON po.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON po.branch_id = pb.branch_id
      WHERE po.purchase_id = ?
    `, [id]);
    if (orders.length === 0) return errorResponse(res, "PO not found", 404);
    const [items] = await db_default.execute(`
      SELECT poi.*, ii.name_en, ii.name_ar, ii.unit_en 
      FROM purchase_order_items poi
      JOIN inventory_items ii ON poi.inventory_item_id = ii.inventory_item_id
      WHERE poi.purchase_id = ?
    `, [id]);
    return successResponse(res, { ...orders[0], items });
  } catch (error) {
    return errorResponse(res, "Failed to fetch PO details", 500, error);
  }
};
var createPurchaseOrder = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const {
      vendor_id,
      branch_id,
      po_number,
      invoice_type,
      tax_amount,
      discount_amount,
      discount_percentage,
      additional_charges,
      final_amount,
      items,
      notes,
      date
    } = req.body;
    const admin_id = req.user.admin_id;
    const [result] = await connection.execute(
      `INSERT INTO purchase_orders (
        vendor_id, admin_id, branch_id, po_number, date, invoice_type, 
        total_amount, tax_amount, discount_amount, discount_percentage, 
        additional_charges, final_amount, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        vendor_id,
        admin_id,
        branch_id && String(branch_id).trim().toLowerCase() === "main" ? null : branch_id || null,
        po_number || `PO-${Date.now()}`,
        date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        invoice_type || "tax_invoice",
        0,
        // total_amount calculated from items
        tax_amount || 0,
        discount_amount || 0,
        discount_percentage || 0,
        additional_charges || 0,
        final_amount || 0,
        notes || null,
        "pending"
      ]
    );
    const purchase_id = result.insertId;
    let total_amount = 0;
    for (const item of items) {
      const line_total = Number(item.quantity) * Number(item.unit_price);
      total_amount += line_total;
      await connection.execute(
        `INSERT INTO purchase_order_items (
          purchase_id, inventory_item_id, variant_id, package_id, quantity, unit_price, 
          amount, discount_amount, additional_charges_percentage, additional_charges_amount, 
          final_amount, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchase_id,
          item.inventory_item_id,
          item.variant_id || null,
          item.package_id || null,
          item.quantity,
          item.unit_price,
          item.amount || line_total,
          item.discount_amount || 0,
          item.additional_charges_percentage || 0,
          item.additional_charges_amount || 0,
          item.final_amount || line_total,
          item.expiry_date || null
        ]
      );
    }
    await connection.execute("UPDATE purchase_orders SET total_amount = ? WHERE purchase_id = ?", [total_amount, purchase_id]);
    await connection.commit();
    return successResponse(res, { purchase_id }, "Purchase order created successfully", 201);
  } catch (error) {
    await connection.rollback();
    console.error("Create PO Error:", error);
    return errorResponse(res, "Failed to create PO segregation", 500, error);
  } finally {
    connection.release();
  }
};
var receivePurchaseOrder = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    const { id } = req.params;
    const admin_id = req.user.admin_id;
    await connection.beginTransaction();
    const [orders] = await connection.execute("SELECT status FROM purchase_orders WHERE purchase_id = ? FOR UPDATE", [id]);
    if (orders.length === 0) throw new Error("PO not found");
    if (orders[0].status !== "pending" && orders[0].status !== "partially_received") throw new Error("PO is not in a receivable state");
    const [items] = await connection.execute(`
      SELECT poi.inventory_item_id, poi.quantity, poi.final_amount as line_final_amount, ip.multiplier
      FROM purchase_order_items poi
      LEFT JOIN inventory_item_packages ip ON poi.package_id = ip.package_id
      WHERE poi.purchase_id = ?
    `, [id]);
    for (const item of items) {
      const multiplier = Number(item.multiplier || 1);
      const totalStockToAdd = Number(item.quantity) * multiplier;
      const costPerUnit = Number(item.line_final_amount) / totalStockToAdd;
      console.log(`\u{1F4E6} RECEIVING FIFO BATCH: ItemID=${item.inventory_item_id}, BaseUnits=+${totalStockToAdd}, CostPerUnit=${costPerUnit.toFixed(3)}`);
      await connection.execute(
        "UPDATE inventory_items SET current_stock = current_stock + ? WHERE inventory_item_id = ?",
        [totalStockToAdd, item.inventory_item_id]
      );
      await connection.execute(
        `INSERT INTO inventory_batches (inventory_item_id, purchase_id, original_quantity, remaining_quantity, cost_per_unit) 
         VALUES (?, ?, ?, ?, ?)`,
        [item.inventory_item_id, id, totalStockToAdd, totalStockToAdd, costPerUnit]
      );
      await connection.execute(
        "INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, new_values) VALUES (?, ?, ?, ?, ?)",
        [admin_id, "FIFO Batch Purchase In", "InventoryItem", item.inventory_item_id, JSON.stringify({
          batch_qty: totalStockToAdd,
          cost_per_unit: costPerUnit,
          purchase_id: id
        })]
      );
    }
    await connection.execute(
      "UPDATE purchase_orders SET status = ?, received_at = CURRENT_TIMESTAMP, received_by = ? WHERE purchase_id = ?",
      ["received", admin_id, id]
    );
    await connection.commit();
    return successResponse(res, null, "Stock received into segregated inventory successfully");
  } catch (error) {
    await connection.rollback();
    console.error("SERVER PO RECEIVE ERROR:", error);
    return errorResponse(res, error.message || "Failed to receive PO network", 500);
  } finally {
    connection.release();
  }
};
var updatePurchaseOrder = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    const { id } = req.params;
    const {
      vendor_id,
      branch_id,
      invoice_type,
      tax_amount,
      discount_amount,
      discount_percentage,
      additional_charges,
      final_amount,
      items,
      notes,
      date
    } = req.body;
    await connection.beginTransaction();
    const [orders] = await connection.execute("SELECT status FROM purchase_orders WHERE purchase_id = ? FOR UPDATE", [id]);
    if (orders.length === 0) throw new Error("PO not found");
    if (orders[0].status === "received" || orders[0].status === "cancelled") {
      throw new Error(`Cannot edit order in ${orders[0].status} status`);
    }
    let total_amount = 0;
    items.forEach((item) => total_amount += Number(item.quantity) * Number(item.unit_price));
    await connection.execute(
      `UPDATE purchase_orders SET 
        vendor_id = ?, 
        branch_id = ?,
        invoice_type = ?,
        total_amount = ?, 
        tax_amount = ?,
        discount_amount = ?,
        discount_percentage = ?,
        additional_charges = ?,
        final_amount = ?,
        notes = ?,
        date = ?
      WHERE purchase_id = ?`,
      [
        vendor_id,
        branch_id && String(branch_id).trim().toLowerCase() === "main" ? null : branch_id || null,
        invoice_type || "tax_invoice",
        total_amount,
        tax_amount || 0,
        discount_amount || 0,
        discount_percentage || 0,
        additional_charges || 0,
        final_amount || 0,
        notes || null,
        date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        id
      ]
    );
    await connection.execute("DELETE FROM purchase_order_items WHERE purchase_id = ?", [id]);
    for (const item of items) {
      const line_total = Number(item.quantity) * Number(item.unit_price);
      await connection.execute(
        `INSERT INTO purchase_order_items (
          purchase_id, inventory_item_id, variant_id, package_id, quantity, unit_price, 
          amount, discount_amount, additional_charges_percentage, additional_charges_amount, 
          final_amount, expiry_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          item.inventory_item_id,
          item.variant_id || null,
          item.package_id || null,
          item.quantity,
          item.unit_price,
          item.amount || line_total,
          item.discount_amount || 0,
          item.additional_charges_percentage || 0,
          item.additional_charges_amount || 0,
          item.final_amount || line_total,
          item.expiry_date || null
        ]
      );
    }
    await connection.commit();
    return successResponse(res, null, "Purchase order updated successfully");
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, error.message || "Failed to update PO", 500);
  } finally {
    connection.release();
  }
};
var deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const [orders] = await db_default.execute("SELECT status FROM purchase_orders WHERE purchase_id = ?", [id]);
    if (orders.length === 0) return errorResponse(res, "PO not found", 404);
    if (orders[0].status === "received") {
      return errorResponse(res, "Cannot delete a received purchase order. Please reverse it first.", 400);
    }
    await db_default.execute("UPDATE purchase_orders SET deleted_at = CURRENT_TIMESTAMP WHERE purchase_id = ?", [id]);
    return successResponse(res, null, "Purchase order deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete purchase order", 500, error);
  }
};

// src/routes/purchase.routes.ts
var router5 = Router5();
router5.use(authMiddleware);
router5.get("/", getPurchaseOrders);
router5.get("/:id", getPurchaseOrderById);
router5.post("/", authorize(["super_admin", "manager", "inventory_controller"]), createPurchaseOrder);
router5.put("/:id", authorize(["super_admin", "manager"]), updatePurchaseOrder);
router5.post("/:id/receive", authorize(["super_admin", "manager", "inventory_controller"]), receivePurchaseOrder);
router5.delete("/:id", authorize(["super_admin", "manager"]), deletePurchaseOrder);
var purchase_routes_default = router5;

// src/routes/menu.routes.ts
import { Router as Router6 } from "express";

// src/controllers/menu.controller.ts
init_db();
var getMenuItems = async (req, res) => {
  try {
    const user = req.user;
    const branchId = user?.branch_id || req.query.branch_id || null;
    const isPOS = req.query.pos === "true";
    let selectFields = `mi.*, c.name_en as category_name`;
    let joinClause = ``;
    const params = [];
    if (branchId) {
      selectFields = `
        mi.menu_item_id, mi.brand_id, mi.category_id, mi.name_en, mi.name_ar, mi.barcode, mi.unit_en, mi.unit_ar, mi.yield_quantity, mi.description_en, mi.description_ar, mi.cost_price, mi.type, mi.image_url, mi.sort_order, mi.created_at, mi.updated_at, mi.deleted_at,
        COALESCE(bmi.custom_price, mi.price) as price,
        COALESCE(bmi.status, mi.status) as status,
        bmi.custom_price as branch_custom_price,
        bmi.status as branch_status,
        c.name_en as category_name
      `;
      joinClause = `LEFT JOIN branch_menu_items bmi ON mi.menu_item_id = bmi.menu_item_id AND bmi.branch_id = ?`;
      params.push(branchId);
    }
    let query = `
      SELECT ${selectFields}
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.category_id
      ${joinClause}
      WHERE mi.deleted_at IS NULL
    `;
    if (user && user.brand_id) {
      query += " AND mi.brand_id = ?";
      params.push(user.brand_id);
    } else if (req.query.brand_id) {
      query += " AND mi.brand_id = ?";
      params.push(req.query.brand_id);
    }
    if (branchId && isPOS) {
      query += " AND COALESCE(bmi.status, mi.status) = 'available'";
    }
    query += " ORDER BY mi.sort_order ASC, mi.name_en ASC";
    const [items] = await db_default.execute(query, params);
    return successResponse(res, items);
  } catch (error) {
    console.error("getMenuItems Error:", error);
    return errorResponse(res, "Failed to fetch menu items", 500, error);
  }
};
var getMenuItemDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const [items] = await db_default.execute("SELECT * FROM menu_items WHERE menu_item_id = ?", [id]);
    if (items.length === 0) return errorResponse(res, "Item not found", 404);
    const [ingredients] = await db_default.execute(`
      SELECT 
        mii.*, 
        COALESCE(ii.name_en, smi.name_en) as name_en,
        COALESCE(ii.unit_en, 'Batch') as unit_en 
      FROM menu_item_ingredients mii
      LEFT JOIN inventory_items ii ON mii.inventory_item_id = ii.inventory_item_id
      LEFT JOIN menu_items smi ON mii.sub_menu_item_id = smi.menu_item_id
      WHERE mii.menu_item_id = ?
    `, [id]);
    const [branchCustomizations] = await db_default.execute(`
      SELECT bmi.*, b.name_en as branch_name 
      FROM branch_menu_items bmi 
      JOIN branches b ON bmi.branch_id = b.branch_id 
      WHERE bmi.menu_item_id = ?
    `, [id]);
    return successResponse(res, { ...items[0], ingredients, branch_customizations: branchCustomizations });
  } catch (error) {
    console.error("getMenuItemDetails Error:", error);
    return errorResponse(res, "Failed to fetch menu details", 500, error);
  }
};
var createMenuItem = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const user = req.user;
    const { name_en, name_ar, category_id, price, cost_price, description_en, description_ar, type, barcode, unit_en, unit_ar } = req.body;
    let { ingredients } = req.body;
    let brandId = req.body.brand_id || null;
    if (user && user.brand_id) {
      brandId = user.brand_id;
    }
    if (typeof ingredients === "string") {
      try {
        ingredients = JSON.parse(ingredients);
      } catch (e) {
        ingredients = [];
      }
    }
    const image_url = req.file ? `/uploads/menu/${req.file.filename}` : null;
    const yield_quantity = Number(req.body.yield_quantity || 1);
    const [result] = await connection.execute(
      "INSERT INTO menu_items (category_id, name_en, name_ar, barcode, price, unit_en, unit_ar, cost_price, type, description_en, description_ar, image_url, yield_quantity, brand_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        category_id || null,
        name_en,
        name_ar,
        barcode || null,
        Number(price || 0),
        unit_en || "piece",
        unit_ar || "\u062D\u0628\u0629",
        Number(cost_price || 0),
        type || "selling",
        description_en || null,
        description_ar || null,
        image_url,
        yield_quantity,
        brandId
      ]
    );
    const menu_item_id = result.insertId;
    if (ingredients && Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        let invId = null;
        let subMenuId = null;
        const rawId = String(ing.inventory_item_id || "");
        if (rawId.startsWith("pre-")) {
          subMenuId = rawId.replace("pre-", "");
        } else {
          invId = rawId.replace("inv-", "");
        }
        if (!invId && !subMenuId) continue;
        await connection.execute(
          "INSERT INTO menu_item_ingredients (menu_item_id, inventory_item_id, sub_menu_item_id, package_id, quantity) VALUES (?, ?, ?, ?, ?)",
          [menu_item_id, invId, subMenuId, ing.package_id || null, ing.quantity]
        );
      }
    }
    let { branch_customizations } = req.body;
    if (typeof branch_customizations === "string") {
      try {
        branch_customizations = JSON.parse(branch_customizations);
      } catch (e) {
        branch_customizations = [];
      }
    }
    if (branch_customizations && Array.isArray(branch_customizations)) {
      for (const custom of branch_customizations) {
        const hasCustomPrice = custom.custom_price !== void 0 && custom.custom_price !== "" && custom.custom_price !== null;
        const isUnavailable = custom.status === "unavailable";
        if (hasCustomPrice || isUnavailable) {
          const cPrice = hasCustomPrice ? Number(custom.custom_price) : null;
          await connection.execute(
            "INSERT INTO branch_menu_items (branch_id, menu_item_id, custom_price, status) VALUES (?, ?, ?, ?)",
            [custom.branch_id, menu_item_id, cPrice, custom.status || "available"]
          );
        }
      }
    }
    await connection.commit();
    return successResponse(res, { menu_item_id }, "Menu item created with recipe successfully!", 201);
  } catch (error) {
    await connection.rollback();
    console.error("\u26D4 createMenuItem FAILURE:", error.message);
    return errorResponse(res, `Database Error: ${error.message}`, 500, error);
  } finally {
    connection.release();
  }
};
var updateMenuItem = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    const { id } = req.params;
    await connection.beginTransaction();
    const [existing] = await connection.execute("SELECT image_url FROM menu_items WHERE menu_item_id = ?", [id]);
    if (existing.length === 0) throw new Error("Item not found");
    const { name_en, name_ar, category_id, price, unit_en, unit_ar, cost_price, description_en, description_ar, status, type, barcode } = req.body;
    let ingredients = req.body.ingredients;
    if (typeof ingredients === "string") {
      try {
        ingredients = JSON.parse(ingredients);
      } catch (e) {
        ingredients = [];
      }
    }
    const image_url = req.file ? `/uploads/menu/${req.file.filename}` : existing[0].image_url;
    const yield_quantity = Number(req.body.yield_quantity || 1);
    await connection.execute(
      `UPDATE menu_items SET 
        category_id = ?, 
        name_en = ?, 
        name_ar = ?, 
        barcode = ?,
        price = ?, 
        unit_en = ?,
        unit_ar = ?,
        cost_price = ?, 
        type = ?,
        description_en = ?, 
        description_ar = ?, 
        image_url = ?,
        status = ?,
        yield_quantity = ?
      WHERE menu_item_id = ?`,
      [category_id, name_en, name_ar, barcode || null, price, unit_en || "piece", unit_ar || "\u062D\u0628\u0629", cost_price || 0, type || "selling", description_en || null, description_ar || null, image_url, status || "available", yield_quantity, id]
    );
    await connection.execute("DELETE FROM menu_item_ingredients WHERE menu_item_id = ?", [id]);
    if (ingredients && Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        let invId = null;
        let subMenuId = null;
        const rawId = String(ing.inventory_item_id || "");
        if (rawId.startsWith("pre-")) {
          subMenuId = rawId.replace("pre-", "");
        } else {
          invId = rawId.replace("inv-", "");
        }
        if (!invId && !subMenuId) continue;
        await connection.execute(
          "INSERT INTO menu_item_ingredients (menu_item_id, inventory_item_id, sub_menu_item_id, package_id, quantity) VALUES (?, ?, ?, ?, ?)",
          [id, invId, subMenuId, ing.package_id || null, ing.quantity]
        );
      }
    }
    await connection.execute("DELETE FROM branch_menu_items WHERE menu_item_id = ?", [id]);
    let { branch_customizations } = req.body;
    if (typeof branch_customizations === "string") {
      try {
        branch_customizations = JSON.parse(branch_customizations);
      } catch (e) {
        branch_customizations = [];
      }
    }
    if (branch_customizations && Array.isArray(branch_customizations)) {
      for (const custom of branch_customizations) {
        const hasCustomPrice = custom.custom_price !== void 0 && custom.custom_price !== "" && custom.custom_price !== null;
        const isUnavailable = custom.status === "unavailable";
        if (hasCustomPrice || isUnavailable) {
          const cPrice = hasCustomPrice ? Number(custom.custom_price) : null;
          await connection.execute(
            "INSERT INTO branch_menu_items (branch_id, menu_item_id, custom_price, status) VALUES (?, ?, ?, ?)",
            [custom.branch_id, id, cPrice, custom.status || "available"]
          );
        }
      }
    }
    await connection.commit();
    return successResponse(res, null, "Menu item updated successfully");
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, error.message || "Failed to update menu item", 500, error);
  } finally {
    connection.release();
  }
};
var deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    await db_default.execute("UPDATE menu_items SET deleted_at = CURRENT_TIMESTAMP WHERE menu_item_id = ?", [id]);
    return successResponse(res, null, "Menu item deleted");
  } catch (error) {
    console.error("deleteMenuItem Error:", error);
    return errorResponse(res, "Failed to delete menu item", 500, error);
  }
};

// src/middleware/upload.middleware.ts
import multer from "multer";
import path3 from "path";
import fs2 from "fs";
var createDir = (dirPath) => {
  if (!fs2.existsSync(dirPath)) {
    fs2.mkdirSync(dirPath, { recursive: true });
  }
};
var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path3.join(process.cwd(), "uploads/menu");
    createDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path3.extname(file.originalname));
  }
});
var fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Selected file is not an image!"), false);
  }
};
var upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
    // 5MB Limit
  }
});

// src/routes/menu.routes.ts
var router6 = Router6();
router6.use(authMiddleware);
router6.get("/", getMenuItems);
router6.get("/:id", getMenuItemDetails);
router6.post("/", authorize(["super_admin", "manager", "Admin", "inventory"]), upload.single("image"), restoreTenantContext, createMenuItem);
router6.put("/:id", authorize(["super_admin", "manager", "Admin", "inventory"]), upload.single("image"), restoreTenantContext, updateMenuItem);
router6.delete("/:id", authorize(["super_admin", "Admin", "inventory"]), deleteMenuItem);
var menu_routes_default = router6;

// src/routes/branch.routes.ts
import { Router as Router7 } from "express";

// src/controllers/branch.controller.ts
init_db();
init_tenantContext();
var getBranches = async (req, res) => {
  try {
    const user = req.user;
    let query = "SELECT * FROM branches WHERE deleted_at IS NULL";
    const params = [];
    if (user && user.brand_id) {
      query += " AND brand_id = ?";
      params.push(user.brand_id);
    }
    query += " ORDER BY name_en";
    const [branches] = await db_default.execute(query, params);
    return successResponse(res, branches);
  } catch (error) {
    return errorResponse(res, "Failed to fetch branches", 500, error);
  }
};
var createBranch = async (req, res) => {
  try {
    const user = req.user;
    const { name_en, name_ar, location_en, location_ar, phone } = req.body;
    let brandId = req.body.brand_id || null;
    if (user && user.brand_id) {
      brandId = user.brand_id;
    }
    const [countRows] = await db_default.execute("SELECT COUNT(*) as count FROM branches WHERE deleted_at IS NULL");
    const currentCount = countRows[0].count;
    const dbName = tenantContext.getStore()?.dbName || "kms_master";
    if (dbName !== "kms_master") {
      const [tenantRows] = await masterPool.execute(
        "SELECT base_branches, extra_branches FROM tenants WHERE db_name = ?",
        [dbName]
      );
      if (tenantRows && tenantRows.length > 0) {
        const limit = (tenantRows[0].base_branches || 1) + (tenantRows[0].extra_branches || 0);
        if (currentCount >= limit) {
          return errorResponse(res, `Branch limit reached: Your current subscription allows a maximum of ${limit} branch(es). Please upgrade your subscription limit first.`, 403);
        }
      }
    }
    const [result] = await db_default.execute(
      "INSERT INTO branches (name_en, name_ar, location_en, location_ar, phone, brand_id) VALUES (?, ?, ?, ?, ?, ?)",
      [name_en, name_ar, location_en || null, location_ar || null, phone || null, brandId]
    );
    return successResponse(res, { branch_id: result.insertId }, "Branch created successfully", 201);
  } catch (error) {
    return errorResponse(res, "Failed to create branch", 500, error);
  }
};
var updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_en, name_ar, location_en, location_ar, phone, status } = req.body;
    await db_default.execute(
      `UPDATE branches SET name_en = ?, name_ar = ?, location_en = ?, location_ar = ?, phone = ?, status = ? 
       WHERE branch_id = ?`,
      [name_en, name_ar, location_en || null, location_ar || null, phone || null, status || "active", id]
    );
    return successResponse(res, null, "Branch updated successfully");
  } catch (error) {
    return errorResponse(res, "Failed to update branch", 500, error);
  }
};
var deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    await db_default.execute("UPDATE branches SET deleted_at = CURRENT_TIMESTAMP WHERE branch_id = ?", [id]);
    return successResponse(res, null, "Branch deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete branch", 500, error);
  }
};

// src/routes/branch.routes.ts
var router7 = Router7();
router7.use(authMiddleware);
router7.get("/", getBranches);
router7.post("/", authorize(["super_admin", "manager"]), createBranch);
router7.put("/:id", authorize(["super_admin", "manager"]), updateBranch);
router7.delete("/:id", authorize(["super_admin"]), deleteBranch);
var branch_routes_default = router7;

// src/routes/sales.routes.ts
import { Router as Router8 } from "express";

// src/controllers/sales.controller.ts
init_db();
var getSales = async (req, res) => {
  try {
    const user = req.user;
    let query = `
      SELECT s.*, 
      (SELECT COUNT(*) FROM sales_order_items WHERE sale_id = s.sale_id) as items_count,
      IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0) as returns_amount,
      DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
      b.name_en as branch_name,
      b.phone as branch_phone,
      s.client_phone as client_phone,
      a.first_name as salesman_name,
      s.payment_method
      FROM sales_orders s 
      LEFT JOIN branches b ON s.branch_id = b.branch_id
      LEFT JOIN admins a ON s.admin_id = a.admin_id
      WHERE s.deleted_at IS NULL
    `;
    const params = [];
    if (user && user.brand_id) {
      query += " AND s.brand_id = ?";
      params.push(user.brand_id);
    } else if (req.query.brand_id) {
      query += " AND s.brand_id = ?";
      params.push(req.query.brand_id);
    }
    if (user && user.branch_id) {
      query += " AND s.branch_id = ?";
      params.push(user.branch_id);
    }
    query += " ORDER BY s.created_at DESC, s.sale_id DESC";
    const [rows] = await db_default.execute(query, params);
    if (rows.length > 0) {
      const saleIds = rows.map((r) => r.sale_id);
      const [items] = await db_default.execute(`
        SELECT soi.sale_id, soi.menu_item_id, mi.name_en, soi.quantity,
          (
             SELECT COALESCE(SUM(sri.quantity), 0) 
             FROM sales_return_items sri 
             JOIN sales_returns sr ON sri.return_id = sr.return_id 
             WHERE sri.menu_item_id = soi.menu_item_id AND sr.sale_id = soi.sale_id
          ) as returns_qty
        FROM sales_order_items soi
        JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
        WHERE soi.sale_id IN (${saleIds.join(",")})
      `);
      rows.forEach((row) => {
        row.items_json = JSON.stringify(items.filter((i) => i.sale_id === row.sale_id));
      });
    }
    return successResponse(res, rows);
  } catch (error) {
    return errorResponse(res, "Failed to fetch sales", 500, error);
  }
};
var getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const [orders] = await db_default.execute(`
      SELECT s.*, 
             DATE_FORMAT(s.created_at, '%Y-%m-%d') as order_date,
             DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
             b.name_en as branch_name,
             b.phone as branch_phone,
             s.client_phone as client_phone,
             a.first_name as salesman_name,
             s.payment_method
      FROM sales_orders s 
      LEFT JOIN branches b ON s.branch_id = b.branch_id
      LEFT JOIN admins a ON s.admin_id = a.admin_id
      WHERE s.sale_id = ?
    `, [id]);
    if (orders.length === 0) return errorResponse(res, "Order not found", 404);
    const [items] = await db_default.execute(`
      SELECT soi.*, mi.name_en, mi.name_ar
      FROM sales_order_items soi
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      WHERE soi.sale_id = ?
    `, [id]);
    const orderData = { ...orders[0], items };
    return successResponse(res, orderData);
  } catch (error) {
    return errorResponse(res, "Failed to fetch order details", 500, error);
  }
};
var createSale = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    const { branch_id, customer_name, client_phone, client_address, notes, items, total_amount, order_type, payment_method, payment_status, counter_id } = req.body;
    const admin_id = req.user?.admin_id || 1;
    let brandId = req.user?.brand_id || null;
    await connection.beginTransaction();
    if (!brandId && branch_id) {
      const [branchRows] = await connection.execute(
        "SELECT brand_id FROM branches WHERE branch_id = ?",
        [branch_id]
      );
      if (branchRows && branchRows.length > 0) {
        brandId = branchRows[0].brand_id;
      }
    }
    const [orderRes] = await connection.execute(
      "INSERT INTO sales_orders (order_number, branch_id, order_type, payment_method, payment_status, customer_name, client_phone, client_address, notes, total_amount, status, admin_id, brand_id, counter_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["PENDING", branch_id || 1, order_type || "walk_in", payment_method || "cash", payment_status || (payment_method === "credit" ? "credit" : "paid"), customer_name || null, client_phone || null, client_address || null, notes || null, total_amount, "completed", admin_id, brandId, counter_id || null]
    );
    const sale_id = orderRes.insertId;
    const [settingsRows] = await connection.execute(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'order_prefix'"
    );
    const prefix = settingsRows && settingsRows.length > 0 ? settingsRows[0].setting_value : "ORD-";
    const order_number = `${prefix}${1e5 + sale_id}`;
    await connection.execute(
      "UPDATE sales_orders SET order_number = ? WHERE sale_id = ?",
      [order_number, sale_id]
    );
    for (const item of items) {
      await connection.execute(
        "INSERT INTO sales_order_items (sale_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?)",
        [sale_id, item.menu_item_id, item.quantity, item.price]
      );
      const [ingredients] = await connection.execute(`
        SELECT mii.inventory_item_id, mii.quantity, mii.package_id, ip.multiplier
        FROM menu_item_ingredients mii
        LEFT JOIN inventory_item_packages ip ON mii.package_id = ip.package_id
        WHERE mii.menu_item_id = ?
      `, [item.menu_item_id]);
      for (const ingredient of ingredients) {
        let multiplier = 1;
        if (ingredient.package_id === "virtual_gram" || ingredient.package_id === "virtual_ml") {
          multiplier = 1e-3;
        } else if (ingredient.multiplier) {
          multiplier = Number(ingredient.multiplier);
        }
        const totalDeduction = Number(ingredient.quantity) * Number(item.quantity) * multiplier;
        let remainingToDeduct = totalDeduction;
        const [batches] = await connection.execute(
          'SELECT batch_id, remaining_quantity FROM inventory_batches WHERE inventory_item_id = ? AND status = "active" ORDER BY created_at ASC FOR UPDATE',
          [ingredient.inventory_item_id]
        );
        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;
          const batchQty = Number(batch.remaining_quantity);
          const deductFromThisBatch = Math.min(batchQty, remainingToDeduct);
          const newBatchQty = batchQty - deductFromThisBatch;
          remainingToDeduct -= deductFromThisBatch;
          await connection.execute(
            "UPDATE inventory_batches SET remaining_quantity = ?, status = ? WHERE batch_id = ?",
            [newBatchQty, newBatchQty <= 0 ? "exhausted" : "active", batch.batch_id]
          );
          console.log(`\u{1F4E1} FIFO CONSUMED: BatchID=${batch.batch_id}, Deducted=${deductFromThisBatch}, Remains=${newBatchQty}`);
        }
        await connection.execute(
          "UPDATE inventory_items SET current_stock = current_stock - ? WHERE inventory_item_id = ?",
          [totalDeduction, ingredient.inventory_item_id]
        );
        await connection.execute(
          "INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, new_values) VALUES (?, ?, ?, ?, ?)",
          [admin_id, "Stock Deduction (Sale)", "InventoryItem", ingredient.inventory_item_id, JSON.stringify({ sale_id, deducted_qty: totalDeduction })]
        );
      }
    }
    await connection.commit();
    console.log("\u2705 Sale created successfully:", sale_id);
    return successResponse(res, { sale_id, order_number }, "Sale recorded successfully");
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("\u274C CREATE SALE ERROR:", error);
    return errorResponse(res, "Failed to create sale: " + (error instanceof Error ? error.message : String(error)), 500, error);
  } finally {
    if (connection) connection.release();
  }
};
var updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status } = req.body;
    await db_default.execute("UPDATE sales_orders SET payment_status = ? WHERE sale_id = ?", [payment_status, id]);
    return successResponse(res, null, "Payment status updated");
  } catch (error) {
    return errorResponse(res, "Update failed", 500, error);
  }
};
var updateSaleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { dispatch_status } = req.body;
    const [order] = await db_default.execute("SELECT order_number, customer_name FROM sales_orders WHERE sale_id = ?", [id]);
    await db_default.execute(
      "UPDATE sales_orders SET dispatch_status = ? WHERE sale_id = ?",
      [dispatch_status, id]
    );
    if (order.length > 0) {
      const msg = `\u26A1 Order ${order[0].order_number} (${order[0].customer_name}) status updated to: ${dispatch_status.toUpperCase()}`;
      const type = dispatch_status === "delivered" ? "success" : dispatch_status === "dispatched" ? "info" : "warning";
      await db_default.execute(
        "INSERT INTO notifications (message, type) VALUES (?, ?)",
        [msg, type]
      );
    }
    return successResponse(res, null, "Status updated successfully");
  } catch (error) {
    return errorResponse(res, "Update failed", 500, error);
  }
};
var deleteSale = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const admin_id = req.user?.admin_id || 1;
    const [items] = await connection.execute(
      "SELECT menu_item_id, quantity FROM sales_order_items WHERE sale_id = ?",
      [id]
    );
    for (const item of items) {
      const [ingredients] = await connection.execute(`
        SELECT mii.inventory_item_id, mii.quantity, mii.package_id, ip.multiplier
        FROM menu_item_ingredients mii
        LEFT JOIN inventory_item_packages ip ON mii.package_id = ip.package_id
        WHERE mii.menu_item_id = ?
      `, [item.menu_item_id]);
      for (const ingredient of ingredients) {
        let multiplier = 1;
        if (ingredient.package_id === "virtual_gram" || ingredient.package_id === "virtual_ml") {
          multiplier = 1e-3;
        } else if (ingredient.multiplier) {
          multiplier = Number(ingredient.multiplier);
        }
        const totalRestoration = Number(ingredient.quantity) * Number(item.quantity) * multiplier;
        await connection.execute(
          "UPDATE inventory_items SET current_stock = current_stock + ? WHERE inventory_item_id = ?",
          [totalRestoration, ingredient.inventory_item_id]
        );
        const [targetBatch] = await connection.execute(
          'SELECT batch_id FROM inventory_batches WHERE inventory_item_id = ? AND status = "active" ORDER BY created_at ASC LIMIT 1',
          [ingredient.inventory_item_id]
        );
        if (targetBatch.length > 0) {
          await connection.execute(
            'UPDATE inventory_batches SET remaining_quantity = remaining_quantity + ?, status = "active" WHERE batch_id = ?',
            [totalRestoration, targetBatch[0].batch_id]
          );
        }
        await connection.execute(
          "INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, new_values) VALUES (?, ?, ?, ?, ?)",
          [admin_id, "Stock Restoration (Delete Order)", "InventoryItem", ingredient.inventory_item_id, JSON.stringify({ sale_id: id, restored_qty: totalRestoration })]
        );
      }
    }
    await connection.execute("UPDATE sales_orders SET deleted_at = CURRENT_TIMESTAMP WHERE sale_id = ?", [id]);
    await connection.commit();
    return successResponse(res, null, "Order deleted and stock reverted successfully");
  } catch (error) {
    if (connection) await connection.rollback();
    return errorResponse(res, "Failed to delete order and revert stock: " + error.message, 500, error);
  } finally {
    if (connection) connection.release();
  }
};
var returnOrder = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    const { id } = req.params;
    const saleId = parseInt(id);
    const admin_id = req.user?.admin_id || 1;
    console.log("\u{1F504} STARTING ORDER RETURN:", { saleId });
    await connection.beginTransaction();
    const [items] = await connection.execute(
      "SELECT menu_item_id, quantity FROM sales_order_items WHERE sale_id = ?",
      [saleId]
    );
    console.log("\u{1F4E6} ITEMS FOUND FOR RETURN:", items.length);
    for (const item of items) {
      const [ingredients] = await connection.execute(`
        SELECT mii.inventory_item_id, mii.quantity, mii.package_id, ip.multiplier
        FROM menu_item_ingredients mii
        LEFT JOIN inventory_item_packages ip ON mii.package_id = ip.package_id
        WHERE mii.menu_item_id = ?
      `, [item.menu_item_id]);
      for (const ingredient of ingredients) {
        let multiplier = 1;
        if (ingredient.package_id === "virtual_gram" || ingredient.package_id === "virtual_ml") {
          multiplier = 1e-3;
        } else if (ingredient.multiplier) {
          multiplier = Number(ingredient.multiplier);
        }
        const totalRestoration = Number(ingredient.quantity) * Number(item.quantity) * multiplier;
        console.log(`\u{1F50B} RESTORING INGREDIENT FIFO: id=${ingredient.inventory_item_id}, qty=${totalRestoration}`);
        const [targetBatch] = await connection.execute(
          'SELECT batch_id FROM inventory_batches WHERE inventory_item_id = ? AND status = "active" ORDER BY created_at ASC LIMIT 1',
          [ingredient.inventory_item_id]
        );
        if (targetBatch.length > 0) {
          await connection.execute(
            'UPDATE inventory_batches SET remaining_quantity = remaining_quantity + ?, status = "active" WHERE batch_id = ?',
            [totalRestoration, targetBatch[0].batch_id]
          );
        }
        await connection.execute(
          "UPDATE inventory_items SET current_stock = current_stock + ? WHERE inventory_item_id = ?",
          [totalRestoration, ingredient.inventory_item_id]
        );
        await connection.execute(
          "INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, new_values) VALUES (?, ?, ?, ?, ?)",
          [admin_id, "Stock Restoration (Return)", "InventoryItem", ingredient.inventory_item_id, JSON.stringify({ sale_id: saleId, restored_qty: totalRestoration })]
        );
      }
    }
    await connection.execute(
      "UPDATE sales_orders SET dispatch_status = ?, payment_status = ? WHERE sale_id = ?",
      ["cancelled", "failed", saleId]
    );
    await connection.commit();
    console.log("\u2705 RETURN SUCCESSFUL:", saleId);
    return successResponse(res, null, "Order returned and stock restored successfully");
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("\u274C RETURN ERROR:", error);
    return errorResponse(res, "Failed to process return", 500, error);
  } finally {
    if (connection) connection.release();
  }
};

// src/routes/sales.routes.ts
var router8 = Router8();
router8.get("/", authMiddleware, getSales);
router8.get("/:id", authMiddleware, getSaleById);
router8.post("/", authMiddleware, createSale);
router8.put("/:id/status", authMiddleware, updateSaleStatus);
router8.put("/:id/payment-status", authMiddleware, updatePaymentStatus);
router8.post("/:id/return", authMiddleware, returnOrder);
router8.delete("/:id", authMiddleware, deleteSale);
var sales_routes_default = router8;

// src/routes/accounts.routes.ts
import { Router as Router9 } from "express";

// src/controllers/accounts.controller.ts
init_db();
var getTransactions = async (req, res) => {
  try {
    const [transactions] = await db_default.execute(`
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
  } catch (error) {
    return errorResponse(res, "Failed to fetch transaction history", 500, error);
  }
};
var getFinancialSummary = async (req, res) => {
  try {
    const [income] = await db_default.execute("SELECT SUM(total_amount) as total FROM sales_orders");
    const [expense] = await db_default.execute("SELECT SUM(final_amount) as total FROM purchase_orders");
    const [returns] = await db_default.execute("SELECT SUM(total_credit_amount) as total FROM sales_returns");
    const totalIncome = Number(income[0]?.total || 0);
    const totalExpense = Number(expense[0]?.total || 0) + Number(returns[0]?.total || 0);
    return successResponse(res, {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      currency: "KWD"
    });
  } catch (error) {
    return errorResponse(res, "Summary calculation failed", 500, error);
  }
};

// src/routes/accounts.routes.ts
var router9 = Router9();
router9.get("/transactions", authMiddleware, authorize(["super_admin", "manager"]), getTransactions);
router9.get("/summary", authMiddleware, authorize(["super_admin", "manager"]), getFinancialSummary);
var accounts_routes_default = router9;

// src/routes/factory.routes.ts
import { Router as Router10 } from "express";

// src/controllers/factory.controller.ts
init_db();
var createSalesOrder = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { vendor_id, branch_id, customer_name, items, payment_method, order_number, batch_number, expiry_date, discount_percentage, dispatch_date, salesman_id } = req.body;
    const admin_id = req.user.admin_id;
    const totalAmount = items.reduce((acc, item) => acc + Number(item.quantity) * Number(item.price), 0);
    const discountPercentage = discount_percentage !== void 0 ? Number(discount_percentage) : vendor_id ? 25 : 0;
    const discountAmount = totalAmount * discountPercentage / 100;
    const finalAmount = totalAmount - discountAmount;
    let resolvedCustomerName = customer_name;
    if (vendor_id && !resolvedCustomerName) {
      const [vendor] = await connection.execute("SELECT name_en FROM vendors WHERE vendor_id = ?", [vendor_id]);
      if (vendor.length > 0) resolvedCustomerName = vendor[0].name_en;
    }
    const sanitizedDispatchDate = dispatch_date ? String(dispatch_date).split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const sanitizedExpiryDate = expiry_date ? String(expiry_date).split("T")[0] : null;
    const [orderRes] = await connection.execute(
      `INSERT INTO sales_orders (order_number, vendor_id, branch_id, customer_name, total_amount, discount_percentage, discount_amount, final_amount, payment_method, payment_status, admin_id, salesman_id, batch_number, expiry_date, dispatch_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order_number || `SO-${Date.now()}`, vendor_id || null, branch_id && String(branch_id).trim().toLowerCase() === "main" ? null : branch_id || null, resolvedCustomerName || "Counter Customer", totalAmount, discountPercentage, discountAmount, finalAmount, payment_method || "credit", "pending", admin_id, salesman_id || null, batch_number || null, sanitizedExpiryDate, "pending", sanitizedDispatchDate]
    );
    const sale_id = orderRes.insertId;
    for (const item of items) {
      const [menuItem] = await connection.execute("SELECT current_stock, name_en FROM menu_items WHERE menu_item_id = ? FOR UPDATE", [item.menu_item_id]);
      if (Number(menuItem[0].current_stock) < Number(item.quantity)) {
        throw new Error(`Insufficient stock for ${menuItem[0].name_en}. Have ${menuItem[0].current_stock}, need ${item.quantity}`);
      }
      await connection.execute(
        `INSERT INTO sales_order_items (sale_id, menu_item_id, quantity, price, expiry_date, batch_number) VALUES (?, ?, ?, ?, ?, ?)`,
        [sale_id, item.menu_item_id, item.quantity, item.price, sanitizedExpiryDate, batch_number || null]
      );
      await connection.execute("UPDATE menu_items SET current_stock = current_stock - ? WHERE menu_item_id = ?", [item.quantity, item.menu_item_id]);
    }
    await connection.commit();
    return successResponse(res, { sale_id }, "Sale & Branch Dispatch completed.");
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, error.message || "Sales transaction failed");
  } finally {
    connection.release();
  }
};
var getDispatches = async (req, res) => {
  try {
    const admin = req.user;
    let branchFilter = "";
    const queryParams = [];
    if (admin && admin.branch_id) {
      branchFilter = "AND s.branch_id = ?";
      queryParams.push(admin.branch_id);
    }
    const [dispatches] = await db_default.execute(`
      SELECT 
        s.sales_order_id as sale_id, 
        s.order_number, 
        NULL as vendor_id, 
        s.branch_id, 
        s.customer_name, 
        s.total_amount, 
        0 as discount_amount, 
        s.total_amount as final_amount, 
        s.status as dispatch_status, 
        NULL as batch_number, 
        NULL as expiry_date, 
        DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
        s.created_at,
        s.customer_name as client_name,
        b.name_en as branch_name,
        NULL as salesman_name,
        NULL as salesman_phone,
        s.order_type
      FROM sales_orders s
      LEFT JOIN branches b ON s.branch_id = b.branch_id
      WHERE s.order_type IN ('delivery', 'b2b') AND s.deleted_at IS NULL ${branchFilter}
      ORDER BY s.created_at DESC, s.sales_order_id DESC
    `, queryParams);
    return successResponse(res, dispatches);
  } catch (error) {
    return errorResponse(res, "Failed to fetch dispatches", 500, error);
  }
};
var processReturn = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { sale_id, vendor_id, branch_id, items, reason, salesman_id, return_date } = req.body;
    const admin_id = req.user.admin_id;
    let discountFactor = 1;
    if (sale_id) {
      const [originalOrder] = await connection.execute("SELECT discount_percentage FROM sales_orders WHERE sale_id = ?", [sale_id]);
      if (originalOrder.length > 0) {
        discountFactor = (100 - Number(originalOrder[0].discount_percentage || 0)) / 100;
      }
    } else if (vendor_id) {
      const [vendorInfo] = await connection.execute("SELECT name_en FROM vendors WHERE vendor_id = ?", [vendor_id]);
      if (vendorInfo.length > 0 && vendorInfo[0].name_en.toLowerCase().includes("canteen")) {
        discountFactor = 0.65;
      } else {
        discountFactor = 0.75;
      }
    }
    let total_credit = 0;
    items.forEach((i) => {
      const itemPrice = Number(i.price || i.unit_price || 0);
      total_credit += Number(i.quantity) * itemPrice * discountFactor;
    });
    const sanitizedReturnDate = return_date ? String(return_date).split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const [returnRes] = await connection.execute(
      "INSERT INTO sales_returns (sale_id, vendor_id, branch_id, reason, total_credit_amount, admin_id, salesman_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [sale_id || null, vendor_id, branch_id && String(branch_id).trim().toLowerCase() === "main" ? null : branch_id || null, reason || "Expired", total_credit, admin_id, salesman_id || null, sanitizedReturnDate]
    );
    const return_id = returnRes.insertId;
    for (const item of items) {
      if (Number(item.quantity) <= 0) continue;
      const current_sale_id = item.sale_id || sale_id;
      const [stockInfo] = await connection.execute(`
        SELECT 
          (si.quantity - IFNULL((
            SELECT SUM(ri.quantity) 
            FROM sales_return_items ri 
            JOIN sales_returns sr ON ri.return_id = sr.return_id 
            WHERE sr.sale_id = si.sale_id AND ri.menu_item_id = si.menu_item_id
          ), 0)) as remaining_qty
        FROM sales_order_items si
        WHERE si.sale_id = ? AND si.menu_item_id = ?
      `, [current_sale_id, item.menu_item_id || item.product_id]);
      if (stockInfo.length === 0 || Number(stockInfo[0].remaining_qty) < Number(item.quantity)) {
        throw new Error(`Insufficient quantity for return of item ID ${item.menu_item_id || item.product_id}. Remaining: ${stockInfo.length > 0 ? stockInfo[0].remaining_qty : 0}`);
      }
      await connection.execute(
        "INSERT INTO sales_return_items (return_id, menu_item_id, quantity, unit_price, expiry_date) VALUES (?, ?, ?, ?, ?)",
        [return_id, item.menu_item_id || item.product_id, item.quantity, item.price || item.unit_price, item.expiry_date ? String(item.expiry_date).split("T")[0] : null]
      );
      await connection.execute(
        "INSERT INTO wastage (menu_item_id, return_id, quantity, reason_en, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [item.menu_item_id || item.product_id, return_id, item.quantity, `Returned from Vendor: ${reason || "Expired"}`, admin_id, sanitizedReturnDate]
      );
    }
    await connection.commit();
    return successResponse(res, { return_id }, "Return processed and items wasted.");
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, error.message || "Failed to process return");
  } finally {
    connection.release();
  }
};
var updateSalesOrder = async (req, res) => {
  const { sale_id } = req.params;
  const { vendor_id, branch_id, customer_name, items, batch_number, expiry_date, discount_percentage, dispatch_status, dispatch_date, salesman_id } = req.body;
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute("SELECT dispatch_status FROM sales_orders WHERE sale_id = ? FOR UPDATE", [sale_id]);
    if (existing.length === 0) throw new Error("Order not found");
    const [oldItems] = await connection.execute("SELECT menu_item_id, quantity FROM sales_order_items WHERE sale_id = ?", [sale_id]);
    for (const item of oldItems) {
      await connection.execute("UPDATE menu_items SET current_stock = current_stock + ? WHERE menu_item_id = ?", [item.quantity, item.menu_item_id]);
    }
    await connection.execute("DELETE FROM sales_order_items WHERE sale_id = ?", [sale_id]);
    const totalAmount = items.reduce((acc, item) => acc + Number(item.quantity) * Number(item.price), 0);
    const discP = Number(discount_percentage || 0);
    const discountAmount = totalAmount * discP / 100;
    const finalAmount = totalAmount - discountAmount;
    const sanitizedExp = expiry_date ? String(expiry_date).split("T")[0] : null;
    const sanitizedDisp = dispatch_date ? String(dispatch_date).split("T")[0] : null;
    await connection.execute(
      `UPDATE sales_orders SET 
        vendor_id = ?, 
        branch_id = ?, 
        customer_name = ?, 
        total_amount = ?, 
        discount_percentage = ?, 
        discount_amount = ?, 
        final_amount = ?, 
        batch_number = ?, 
        expiry_date = ?,
        salesman_id = ?,
        dispatch_status = ?${sanitizedDisp ? ", created_at = ?" : ""}
      WHERE sale_id = ?`,
      [
        vendor_id || null,
        branch_id && String(branch_id).trim().toLowerCase() === "main" ? null : branch_id || null,
        customer_name || "Counter Customer",
        totalAmount,
        discP,
        discountAmount,
        finalAmount,
        batch_number || null,
        sanitizedExp,
        salesman_id || null,
        dispatch_status || existing[0].dispatch_status || "pending",
        ...sanitizedDisp ? [sanitizedDisp] : [],
        sale_id
      ]
    );
    for (const item of items) {
      const [stockCheck] = await connection.execute("SELECT current_stock, name_en FROM menu_items WHERE menu_item_id = ? FOR UPDATE", [item.menu_item_id]);
      if (Number(stockCheck[0].current_stock) < Number(item.quantity)) {
        throw new Error(`Insufficient stock for ${stockCheck[0].name_en} during update. Have ${stockCheck[0].current_stock}, need ${item.quantity}`);
      }
      await connection.execute(
        `INSERT INTO sales_order_items (sale_id, menu_item_id, quantity, price, expiry_date, batch_number) VALUES (?, ?, ?, ?, ?, ?)`,
        [sale_id, item.menu_item_id, item.quantity, item.price, sanitizedExp, batch_number || null]
      );
      await connection.execute("UPDATE menu_items SET current_stock = current_stock - ? WHERE menu_item_id = ?", [item.quantity, item.menu_item_id]);
    }
    await connection.commit();
    return successResponse(res, null, "Order fully updated and stock reconciled.");
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, error.message || "Failed to update order", 500, error);
  } finally {
    connection.release();
  }
};
var updateReturn = async (req, res) => {
  const { return_id } = req.params;
  const { items, reason, salesman_id, return_date } = req.body;
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("DELETE FROM sales_return_items WHERE return_id = ?", [return_id]);
    await connection.execute("DELETE FROM wastage WHERE return_id = ?", [return_id]);
    let discountFactor = 1;
    const [retData] = await connection.execute("SELECT sale_id, vendor_id, created_at FROM sales_returns WHERE return_id = ?", [return_id]);
    if (retData.length > 0) {
      if (retData[0].sale_id) {
        const [originalOrder] = await connection.execute("SELECT discount_percentage FROM sales_orders WHERE sale_id = ?", [retData[0].sale_id]);
        if (originalOrder.length > 0) {
          discountFactor = (100 - Number(originalOrder[0].discount_percentage || 0)) / 100;
        }
      } else if (retData[0].vendor_id) {
        const [vendorInfo] = await connection.execute("SELECT name_en FROM vendors WHERE vendor_id = ?", [retData[0].vendor_id]);
        if (vendorInfo.length > 0 && vendorInfo[0].name_en.toLowerCase().includes("canteen")) {
          discountFactor = 0.65;
        } else {
          discountFactor = 0.75;
        }
      }
    }
    let total_credit = 0;
    items.forEach((i) => {
      const itemPrice = Number(i.price || i.unit_price || 0);
      total_credit += Number(i.quantity) * itemPrice * discountFactor;
    });
    const sanitizedReturnDate = return_date ? String(return_date).split("T")[0] : null;
    await connection.execute(
      `UPDATE sales_returns SET reason = ?, salesman_id = ?, total_credit_amount = ?${sanitizedReturnDate ? ", created_at = ?" : ""} WHERE return_id = ?`,
      [reason || "Expired", salesman_id || null, total_credit, ...sanitizedReturnDate ? [sanitizedReturnDate] : [], return_id]
    );
    const admin_id = req.user.admin_id;
    const finalDate = sanitizedReturnDate || (retData.length > 0 ? retData[0].created_at : /* @__PURE__ */ new Date());
    for (const item of items) {
      if (Number(item.quantity) <= 0) continue;
      await connection.execute(
        "INSERT INTO sales_return_items (return_id, menu_item_id, quantity, unit_price, expiry_date) VALUES (?, ?, ?, ?, ?)",
        [return_id, item.menu_item_id || item.product_id, item.quantity, item.price || item.unit_price, item.expiry_date ? String(item.expiry_date).split("T")[0] : null]
      );
      await connection.execute(
        "INSERT INTO wastage (menu_item_id, return_id, quantity, reason_en, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [item.menu_item_id || item.product_id, return_id, item.quantity, `Returned (Updated): ${reason || "Expired"}`, admin_id, finalDate]
      );
    }
    await connection.commit();
    return successResponse(res, null, "Return record updated successfully.");
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, error.message || "Failed to update return", 500, error);
  } finally {
    connection.release();
  }
};
var getReturns = async (req, res) => {
  try {
    const [returns] = await db_default.execute(`
      SELECT 
        r.return_id, r.sale_id, r.total_credit_amount, r.reason, r.created_at,
        v.name_en as client_name,
        v.name_ar as client_name_ar,
        pb.name_en as branch_name,
        pb.name_ar as branch_name_ar,
        (SELECT SUM(ri.quantity * mi.cost_price) 
         FROM sales_return_items ri 
         JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id 
         WHERE ri.return_id = r.return_id) as wastage_loss
      FROM sales_returns r
      LEFT JOIN vendors v ON r.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON r.branch_id = pb.branch_id
      WHERE r.deleted_at IS NULL
      ORDER BY r.created_at DESC
    `);
    return successResponse(res, returns);
  } catch (error) {
    console.error("getReturns Error:", error);
    return errorResponse(res, "Failed to fetch returns history", 500, error);
  }
};
var getOrderItems = async (req, res) => {
  const { sale_id } = req.params;
  try {
    const [items] = await db_default.execute(`
      SELECT 
        si.menu_item_id, 
        (si.quantity - IFNULL((
          SELECT SUM(ri.quantity) 
          FROM sales_return_items ri 
          JOIN sales_returns sr ON ri.return_id = sr.return_id 
          WHERE sr.sale_id = si.sale_id AND ri.menu_item_id = si.menu_item_id
        ), 0)) as quantity, 
        si.price,
        m.name_en, m.name_ar
      FROM sales_order_items si
      JOIN menu_items m ON si.menu_item_id = m.menu_item_id
      WHERE si.sale_id = ?
      HAVING quantity > 0
    `, [sale_id]);
    return successResponse(res, items);
  } catch (error) {
    return errorResponse(res, "Failed to fetch order items", 500, error);
  }
};
var getReturnItems = async (req, res) => {
  const { return_id } = req.params;
  try {
    const [items] = await db_default.execute(`
      SELECT 
        ri.menu_item_id, ri.quantity, 
        (ri.unit_price * (100 - IFNULL(so.discount_percentage, 25)) / 100) as unit_price,
        ri.unit_price as original_price,
        m.name_en, m.name_ar, m.barcode as item_code
      FROM sales_return_items ri
      LEFT JOIN menu_items m ON ri.menu_item_id = m.menu_item_id
      LEFT JOIN sales_returns sr ON ri.return_id = sr.return_id
      LEFT JOIN sales_orders so ON sr.sale_id = so.sale_id
      WHERE ri.return_id = ?
    `, [return_id]);
    return successResponse(res, items);
  } catch (error) {
    return errorResponse(res, "Failed to fetch return items", 500, error);
  }
};
var deleteSalesOrder = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const [items] = await connection.execute(
      "SELECT menu_item_id, quantity FROM sales_order_items WHERE sale_id = ?",
      [id]
    );
    for (const item of items) {
      const [ingredients] = await connection.execute(`
        SELECT mii.inventory_item_id, mii.quantity, mii.package_id, ip.multiplier
        FROM menu_item_ingredients mii
        LEFT JOIN inventory_item_packages ip ON mii.package_id = ip.package_id
        WHERE mii.menu_item_id = ?
      `, [item.menu_item_id]);
      for (const ingredient of ingredients) {
        const multiplier = Number(ingredient.multiplier || 1);
        const totalRestoration = Number(ingredient.quantity) * Number(item.quantity) * multiplier;
        await connection.execute(
          "UPDATE inventory_items SET current_stock = current_stock + ? WHERE inventory_item_id = ?",
          [totalRestoration, ingredient.inventory_item_id]
        );
        const [targetBatch] = await connection.execute(
          'SELECT batch_id FROM inventory_batches WHERE inventory_item_id = ? AND status = "active" ORDER BY created_at ASC LIMIT 1',
          [ingredient.inventory_item_id]
        );
        if (targetBatch.length > 0) {
          await connection.execute(
            'UPDATE inventory_batches SET remaining_quantity = remaining_quantity + ?, status = "active" WHERE batch_id = ?',
            [totalRestoration, targetBatch[0].batch_id]
          );
        }
      }
    }
    await connection.execute("UPDATE sales_orders SET deleted_at = CURRENT_TIMESTAMP WHERE sale_id = ?", [id]);
    await connection.commit();
    return successResponse(res, null, "Order deleted and stock reverted successfully");
  } catch (error) {
    if (connection) await connection.rollback();
    return errorResponse(res, "Failed to delete order and revert stock: " + error.message, 500, error);
  } finally {
    if (connection) connection.release();
  }
};

// src/controllers/production.controller.ts
init_db();
var getProductionLogs = async (req, res) => {
  try {
    const [logs] = await db_default.execute(`
      SELECT 
        pl.production_id, pl.batch_number, 
        DATE_FORMAT(pl.production_date, '%Y-%m-%d') as production_date, 
        DATE_FORMAT(pl.expiry_date, '%Y-%m-%d') as expiry_date, 
        pl.branch_id,
        COUNT(pi.menu_item_id) as total_items,
        SUM(pi.quantity_produced) as total_qty,
        GROUP_CONCAT(CONCAT(mi.name_en, ' (', pi.quantity_produced, ')') SEPARATOR ', ') as product_summary
      FROM production_logs pl
      LEFT JOIN production_items pi ON pl.production_id = pi.production_id
      LEFT JOIN menu_items mi ON pi.menu_item_id = mi.menu_item_id
      WHERE pl.deleted_at IS NULL
      GROUP BY pl.production_id
      ORDER BY pl.production_date DESC, pl.production_id DESC
    `);
    return successResponse(res, logs);
  } catch (error) {
    return errorResponse(res, "Failed to fetch production logs", 500, error);
  }
};
var recordBatchProduction = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { production_date, expiry_date, items, branch_id, vendor_id } = req.body;
    const batch_number = `B-PROD-${Date.now()}`;
    const sanitizedProdDate = production_date ? String(production_date).split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const sanitizedExpDate = expiry_date ? String(expiry_date).split("T")[0] : null;
    const [result] = await connection.execute(
      "INSERT INTO production_logs (batch_number, production_date, expiry_date, branch_id) VALUES (?, ?, ?, ?)",
      [batch_number, sanitizedProdDate, sanitizedExpDate, branch_id && String(branch_id).trim().toLowerCase() === "main" ? null : branch_id || null]
    );
    const production_id = result.insertId;
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await connection.execute(
          "INSERT INTO production_items (production_id, menu_item_id, quantity_produced) VALUES (?, ?, ?)",
          [production_id, item.menu_item_id, item.quantity]
        );
        await connection.execute(
          "UPDATE menu_items SET current_stock = current_stock + ? WHERE menu_item_id = ?",
          [item.quantity, item.menu_item_id]
        );
        const [ingredients] = await connection.execute(
          `SELECT 
            mii.inventory_item_id, 
            mii.quantity, 
            IFNULL(iip.multiplier, 1) as multiplier 
           FROM menu_item_ingredients mii
           LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
           WHERE mii.menu_item_id = ?`,
          [item.menu_item_id]
        );
        for (const ing of ingredients) {
          const totalDeduction = Number(ing.quantity) * Number(ing.multiplier) * Number(item.quantity);
          const [invRows] = await connection.execute(
            "SELECT current_stock, name_en FROM inventory_items WHERE inventory_item_id = ?",
            [ing.inventory_item_id]
          );
          if (invRows.length > 0 && Number(invRows[0].current_stock) < totalDeduction) {
            throw new Error(`Insufficient stock for ingredient: ${invRows[0].name_en}. Available: ${invRows[0].current_stock}, Required: ${totalDeduction}`);
          }
          await connection.execute(
            "UPDATE inventory_items SET current_stock = current_stock - ? WHERE inventory_item_id = ?",
            [totalDeduction, ing.inventory_item_id]
          );
        }
      }
    }
    await connection.commit();
    return successResponse(res, { production_id, batch_number }, "Batch production recorded successfully!");
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, error.message || "Production failed");
  } finally {
    connection.release();
  }
};
var deleteProductionBatch = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const [items] = await connection.execute(
      "SELECT menu_item_id, quantity_produced FROM production_items WHERE production_id = ?",
      [id]
    );
    for (const item of items) {
      const [menuItem] = await connection.execute(
        "SELECT current_stock, name_en FROM menu_items WHERE menu_item_id = ?",
        [item.menu_item_id]
      );
      if (menuItem.length > 0 && Number(menuItem[0].current_stock) < Number(item.quantity_produced)) {
      }
      await connection.execute(
        "UPDATE menu_items SET current_stock = current_stock - ? WHERE menu_item_id = ?",
        [item.quantity_produced, item.menu_item_id]
      );
      const [ingredients] = await connection.execute(
        `SELECT 
          mii.inventory_item_id, 
          mii.quantity as ingredient_qty, 
          IFNULL(iip.multiplier, 1) as multiplier 
         FROM menu_item_ingredients mii
         LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
         WHERE mii.menu_item_id = ?`,
        [item.menu_item_id]
      );
      for (const ing of ingredients) {
        const totalRestoration = Number(ing.ingredient_qty) * Number(ing.multiplier) * Number(item.quantity_produced);
        await connection.execute(
          "UPDATE inventory_items SET current_stock = current_stock + ? WHERE inventory_item_id = ?",
          [totalRestoration, ing.inventory_item_id]
        );
        const [targetBatch] = await connection.execute(
          'SELECT batch_id FROM inventory_batches WHERE inventory_item_id = ? AND status = "active" ORDER BY created_at ASC LIMIT 1',
          [ing.inventory_item_id]
        );
        if (targetBatch.length > 0) {
          await connection.execute(
            'UPDATE inventory_batches SET remaining_quantity = remaining_quantity + ?, status = "active" WHERE batch_id = ?',
            [totalRestoration, targetBatch[0].batch_id]
          );
        }
      }
    }
    await connection.execute("UPDATE production_logs SET deleted_at = CURRENT_TIMESTAMP WHERE production_id = ?", [id]);
    await connection.commit();
    return successResponse(res, null, "Production batch deleted and stock reverted successfully");
  } catch (error) {
    if (connection) await connection.rollback();
    return errorResponse(res, "Failed to delete and revert production batch: " + error.message, 500, error);
  } finally {
    if (connection) connection.release();
  }
};

// src/controllers/dispatch.controller.ts
init_db();
var updateDispatchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const [result] = await db_default.execute(
      "UPDATE sales_orders SET status = ? WHERE sales_order_id = ?",
      [status, id]
    );
    if (result.affectedRows === 0) {
      return errorResponse(res, `No order found with ID ${id}`, 404);
    }
    return successResponse(res, null, `Order status updated to ${status}`);
  } catch (error) {
    return errorResponse(res, "Failed to update status", 500, error);
  }
};

// src/routes/factory.routes.ts
var router10 = Router10();
router10.get("/dispatches", authMiddleware, getDispatches);
router10.get("/returns", authMiddleware, getReturns);
router10.get("/production/logs", authMiddleware, getProductionLogs);
router10.put("/dispatches/:id/status", authMiddleware, updateDispatchStatus);
router10.post("/production/batch", authMiddleware, authorize(["super_admin", "manager", "inventory_controller"]), recordBatchProduction);
router10.post("/sales", authMiddleware, authorize(["super_admin", "manager", "sales_dispatch"]), createSalesOrder);
router10.put("/sales/:sale_id", authMiddleware, authorize(["super_admin", "manager", "sales_dispatch"]), updateSalesOrder);
router10.post("/returns", authMiddleware, authorize(["super_admin", "manager", "sales_dispatch"]), processReturn);
router10.put("/returns/:return_id", authMiddleware, authorize(["super_admin", "manager", "sales_dispatch"]), updateReturn);
router10.get("/sales/:sale_id/items", authMiddleware, getOrderItems);
router10.get("/returns/:return_id/items", authMiddleware, getReturnItems);
router10.delete("/sales/:id", authMiddleware, authorize(["super_admin", "manager"]), deleteSalesOrder);
router10.delete("/production/batch/:id", authMiddleware, authorize(["super_admin", "manager"]), deleteProductionBatch);
var factory_routes_default = router10;

// src/routes/settings.routes.ts
import { Router as Router11 } from "express";
var router11 = Router11();
router11.get("/", authMiddleware, getSettings);
router11.post("/update", authMiddleware, updateSettings);
router11.post("/backup", authMiddleware, triggerBackup);
var settings_routes_default = router11;

// src/routes/analytics.routes.ts
import { Router as Router12 } from "express";

// src/controllers/analytics.controller.ts
init_db();
var getReportScope = (req) => {
  const user = req.user;
  const userBrandId = user?.brand_id || null;
  const userBranchId = user?.branch_id || null;
  const queryBrandId = req.query.brand_id ? Number(req.query.brand_id) : null;
  const queryBranchId = req.query.branch_id ? Number(req.query.branch_id) : null;
  return {
    brandId: userBrandId ? userBrandId : queryBrandId,
    branchId: userBranchId ? userBranchId : queryBranchId
  };
};
var getStoreForecasting = async (req, res) => {
  try {
    const { brandId, branchId } = getReportScope(req);
    const [settingsRows] = await db_default.execute(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'business_type'"
    );
    const businessType = settingsRows && settingsRows.length > 0 ? settingsRows[0].setting_value : "restaurant_pos";
    if (businessType === "restaurant_pos") {
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
      const salesParams = [];
      if (branchId) {
        salesQuery += ` AND s.branch_id = ?`;
        salesParams.push(branchId);
      }
      if (brandId) {
        salesQuery += ` AND s.brand_id = ?`;
        salesParams.push(brandId);
      }
      salesQuery += ` GROUP BY mi.menu_item_id ORDER BY units_sold DESC`;
      const [menuSales] = await db_default.execute(salesQuery, salesParams);
      let menuItems = menuSales;
      if (menuItems.length === 0) {
        let fallbackQuery = `
          SELECT menu_item_id, name_en AS menu_item_name, name_ar AS menu_item_name_ar, price, cost_price, 0 AS units_sold, 0.0 AS daily_velocity
          FROM menu_items
          WHERE deleted_at IS NULL
        `;
        const fallbackParams = [];
        if (brandId) {
          fallbackQuery += ` AND brand_id = ?`;
          fallbackParams.push(brandId);
        }
        fallbackQuery += ` LIMIT 10`;
        const [allMenu] = await db_default.execute(fallbackQuery, fallbackParams);
        menuItems = allMenu;
      }
      if (menuItems.length === 0) {
        return successResponse(res, { forecasting: [] });
      }
      const menuItemIds = menuItems.map((m) => m.menu_item_id).join(",");
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
      const ingParams = [];
      if (brandId) {
        ingQuery += ` AND ii.brand_id = ?`;
        ingParams.push(brandId);
      }
      const [ingredients] = await db_default.execute(ingQuery, ingParams);
      if (ingredients.length === 0) {
        const forecasting2 = menuItems.map((m) => {
          const velocity = parseFloat(m.daily_velocity || "0") * 7;
          return {
            vendor_id: m.menu_item_id,
            vendor_name: m.menu_item_name,
            vendor_name_ar: m.menu_item_name_ar,
            branch_id: null,
            branch_name: "Menu Item",
            recent_wastage_units: 0,
            recent_loss_kwd: 0,
            recent_sales: parseFloat(m.price) * parseFloat(m.units_sold),
            recent_sold_units: parseFloat(m.units_sold),
            sales_velocity: parseFloat(velocity.toFixed(2)),
            wastage_velocity: 0,
            return_rate: 100,
            optimal_dispatch: Math.ceil(velocity * 1.1),
            expected_savings: 0,
            recommendation: m.units_sold > 0 ? "MAINTAIN" : "UNDERPERFORMING",
            actionColor: m.units_sold > 0 ? "emerald" : "rose",
            adjustmentScore: 0,
            priority: m.units_sold > 0 ? "Stable" : "Critical"
          };
        });
        return successResponse(res, { forecasting: forecasting2 });
      }
      const ingredientMap = /* @__PURE__ */ new Map();
      ingredients.forEach((ing) => {
        const menuItem = menuItems.find((m) => m.menu_item_id === ing.menu_item_id);
        const velocity = menuItem ? parseFloat(menuItem.daily_velocity || "0") : 0.1;
        const weeklyDemand = velocity * 7 * parseFloat(ing.qty_per_unit) * parseFloat(ing.multiplier);
        if (!ingredientMap.has(ing.inventory_item_id)) {
          ingredientMap.set(ing.inventory_item_id, {
            inventory_item_id: ing.inventory_item_id,
            name_en: ing.name_en,
            name_ar: ing.name_ar,
            current_stock: parseFloat(ing.current_stock || "0"),
            cost_price: parseFloat(ing.cost_price || "0"),
            unit_en: ing.unit_en,
            unit_ar: ing.unit_ar,
            weekly_demand: 0
          });
        }
        const cached = ingredientMap.get(ing.inventory_item_id);
        cached.weekly_demand += weeklyDemand;
      });
      const forecasting = Array.from(ingredientMap.values()).map((ing) => {
        const weeklyDemand = parseFloat(ing.weekly_demand.toFixed(2));
        const currentStock = ing.current_stock;
        const deficit = Math.max(0, weeklyDemand - currentStock);
        const reorderCost = deficit * ing.cost_price;
        const returnRate = weeklyDemand > 0 ? Math.round(Math.min(100, currentStock / weeklyDemand * 100)) : 100;
        let priority = "Stable";
        let recommendation = "IN STOCK";
        let actionColor = "emerald";
        let optimalDispatch = weeklyDemand;
        if (deficit > 0) {
          recommendation = "REORDER";
          actionColor = "rose";
          optimalDispatch = Math.ceil(weeklyDemand * 1.2);
          priority = currentStock < weeklyDemand * 0.25 ? "Critical" : "Medium";
        } else if (currentStock > weeklyDemand * 3 && weeklyDemand > 0) {
          recommendation = "EXCESS STOCK";
          actionColor = "amber";
          priority = "Low";
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
          return_rate: returnRate,
          // Stock coverage %
          optimal_dispatch: optimalDispatch,
          expected_savings: reorderCost,
          // Deficiency cost / restocking cost
          recommendation,
          actionColor,
          adjustmentScore: deficit > 0 ? Math.round(deficit / weeklyDemand * 100) : 0,
          priority
        };
      });
      return successResponse(res, { forecasting });
    } else {
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
      const statsParams = [];
      if (branchId) {
        statsQuery += ` AND pb.branch_id = ?`;
        statsParams.push(branchId);
      }
      if (brandId) {
        statsQuery += ` AND v.brand_id = ?`;
        statsParams.push(brandId);
      }
      statsQuery += ` GROUP BY v.vendor_id, pb.branch_id`;
      const [stats] = await db_default.execute(statsQuery, statsParams);
      const forecasting = stats.map((store) => {
        const wasteUnits = parseFloat(store.recent_wastage_units || "0");
        const salesKwd = parseFloat(store.recent_sales || "0");
        const lossKwd = parseFloat(store.recent_loss_kwd || "0");
        const soldUnits = parseFloat(store.recent_sold_units || "0");
        const dailySold = parseFloat((soldUnits / 7).toFixed(1));
        const dailyWasted = parseFloat((wasteUnits / 7).toFixed(1));
        const totalRouted = soldUnits + wasteUnits;
        const returnRate = totalRouted > 0 ? parseFloat((wasteUnits / totalRouted * 100).toFixed(1)) : 0;
        let recommendation = "STABLE";
        let actionColor = "emerald";
        let adjustment = 0;
        let priority = "Low";
        let optimalNextDispatch = Math.round(dailySold);
        if (returnRate > 15 || lossKwd > 15) {
          recommendation = "REDUCE DISPATCH";
          actionColor = "rose";
          adjustment = -Math.round(returnRate);
          priority = "Critical";
          optimalNextDispatch = Math.max(0, Math.round(dailySold * 0.75));
        } else if (returnRate < 5 && dailySold > 8) {
          recommendation = "EXPAND SUPPLY";
          actionColor = "emerald";
          adjustment = 20;
          priority = "Growth Option";
          optimalNextDispatch = Math.round(dailySold * 1.25);
        } else {
          recommendation = "MAINTAIN";
          actionColor = "blue";
          adjustment = 0;
          priority = "Stable";
          optimalNextDispatch = Math.round(dailySold);
        }
        const expectedSavings = recommendation === "REDUCE DISPATCH" ? parseFloat((lossKwd * 0.8).toFixed(3)) : 0;
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
    console.error("Forecasting Error:", error);
    return errorResponse(res, "Failed to generate financial analytics", 500, error);
  }
};
var getProductionHealth = async (req, res) => {
  try {
    const { brandId, branchId } = getReportScope(req);
    const [settingsRows] = await db_default.execute(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'business_type'"
    );
    const businessType = settingsRows && settingsRows.length > 0 ? settingsRows[0].setting_value : "restaurant_pos";
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
    if (businessType === "restaurant_pos") {
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
    const [hp] = await db_default.execute(`
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
    const total_profit_7d = parseFloat(data.total_revenue_7d || "0") - parseFloat(data.total_production_cost_7d || "0") - parseFloat(data.total_returns_7d || "0");
    return successResponse(res, {
      ...data,
      total_profit_7d
    });
  } catch (error) {
    console.error("Health Error:", error);
    return errorResponse(res, "Failed to fetch production health", 500, error);
  }
};

// src/routes/analytics.routes.ts
var router12 = Router12();
router12.get("/forecasting", authMiddleware, getStoreForecasting);
router12.get("/health", authMiddleware, getProductionHealth);
var analytics_routes_default = router12;

// src/routes/wastage.routes.ts
import { Router as Router13 } from "express";

// src/controllers/wastage.controller.ts
init_db();
var getWastageLogs = async (req, res) => {
  try {
    const [rows] = await db_default.execute(`
      SELECT w.*, 
             p.name_en as product_name_en, p.name_ar as product_name_ar,
             ii.name_en as item_name_en, ii.name_ar as item_name_ar,
             mi.name_en as menu_name_en, mi.name_ar as menu_name_ar,
             a.username as admin_name,
             (w.quantity * COALESCE(mi.cost_price, ii.cost_price, 0)) as total_wasted_value
      FROM wastage w
      LEFT JOIN products p ON w.product_id = p.product_id
      LEFT JOIN inventory_items ii ON w.inventory_item_id = ii.inventory_item_id
      LEFT JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id
      JOIN admins a ON w.admin_id = a.admin_id
      ORDER BY w.created_at DESC
    `);
    return successResponse(res, rows);
  } catch (error) {
    return errorResponse(res, "Error fetching wastage logs", 500, error);
  }
};
var recordWastage = async (req, res) => {
  const { product_id, menu_item_id, inventory_item_id, quantity, reason_en, reason_ar } = req.body;
  const admin_id = req.user.admin_id;
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      "INSERT INTO wastage (product_id, menu_item_id, inventory_item_id, quantity, reason_en, reason_ar, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [product_id || null, menu_item_id || null, inventory_item_id || null, quantity || 0, reason_en || null, reason_ar || null, admin_id]
    );
    if (inventory_item_id) {
      await connection.execute(
        "UPDATE inventory_items SET current_stock = current_stock - ? WHERE inventory_item_id = ?",
        [quantity, inventory_item_id]
      );
    }
    if (product_id) {
      await connection.execute(
        "UPDATE products SET current_stock = current_stock - ? WHERE product_id = ?",
        [quantity, product_id]
      );
    }
    if (menu_item_id) {
      await connection.execute(
        "UPDATE menu_items SET current_stock = current_stock - ? WHERE menu_item_id = ?",
        [quantity, menu_item_id]
      );
    }
    await connection.commit();
    return successResponse(res, { id: result.insertId }, "Wastage recorded successfully", 201);
  } catch (error) {
    await connection.rollback();
    return errorResponse(res, "Error recording wastage", 500, error);
  } finally {
    connection.release();
  }
};

// src/routes/wastage.routes.ts
var router13 = Router13();
router13.use(authMiddleware);
router13.get("/", getWastageLogs);
router13.post("/", authorize(["super_admin", "manager"]), recordWastage);
var wastage_routes_default = router13;

// src/routes/notification.routes.ts
import { Router as Router14 } from "express";

// src/controllers/notification.controller.ts
init_db();
var getNotifications = async (req, res) => {
  try {
    const [rows] = await db_default.execute(
      "SELECT * FROM notifications WHERE is_read = FALSE ORDER BY created_at DESC LIMIT 50"
    );
    return successResponse(res, rows);
  } catch (error) {
    return errorResponse(res, "Failed to fetch notifications", 500, error);
  }
};
var markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await db_default.execute("UPDATE notifications SET is_read = TRUE WHERE notification_id = ?", [id]);
    return successResponse(res, null, "Notification marked as read");
  } catch (error) {
    return errorResponse(res, "Failed to update notification", 500, error);
  }
};
var clearAll = async (req, res) => {
  try {
    await db_default.execute("UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE");
    return successResponse(res, null, "All notifications cleared");
  } catch (error) {
    return errorResponse(res, "Failed to clear notifications", 500, error);
  }
};

// src/routes/notification.routes.ts
var router14 = Router14();
router14.get("/", authMiddleware, getNotifications);
router14.put("/:id/read", authMiddleware, markAsRead);
router14.post("/clear-all", authMiddleware, clearAll);
var notification_routes_default = router14;

// src/routes/reports.routes.ts
import { Router as Router15 } from "express";

// src/controllers/reports.controller.ts
init_db();
var getReportScope2 = (req) => {
  const user = req.user;
  const userBrandId = user?.brand_id || null;
  const userBranchId = user?.branch_id || null;
  const queryBrandId = req.query.brand_id ? Number(req.query.brand_id) : null;
  const queryBranchId = req.query.branch_id ? Number(req.query.branch_id) : null;
  return {
    brandId: userBrandId ? userBrandId : queryBrandId,
    branchId: userBranchId ? userBranchId : queryBranchId
  };
};
var getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, vendor_id, salesman_id } = req.query;
    const { brandId, branchId } = getReportScope2(req);
    let query = `
      SELECT s.*, 
      IFNULL(v.name_en, s.customer_name) as vendor_name, 
      IFNULL(v.name_ar, s.customer_name) as vendor_name_ar,
      IFNULL(pb.name_en, 'Main') as branch_name,
      IFNULL(pb.name_ar, '\u0627\u0644\u0631\u0626\u064A\u0633\u064A') as branch_name_ar,
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
    const params = [];
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
    const [rows] = await db_default.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error("Sales Report Error:", error);
    return errorResponse(res, "Failed to fetch sales report", 500, error);
  }
};
var getProductionReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
      SELECT pl.production_id, pl.batch_number, 
             DATE_FORMAT(COALESCE(pl.production_date, pl.created_at), '%Y-%m-%d') as report_date,
             pl.expiry_date,
             pi.quantity_produced, 
             COALESCE(mi.name_en, 'Unknown Product') as product_name, 
             COALESCE(mi.name_ar, '\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u0633\u0645\u0649') as product_name_ar,
             COALESCE(mi.price, 0) as price, 
             COALESCE(mi.cost_price, 0) as cost_price
      FROM production_logs pl
      LEFT JOIN production_items pi ON pl.production_id = pi.production_id
      LEFT JOIN menu_items mi ON pi.menu_item_id = mi.menu_item_id
      WHERE pl.deleted_at IS NULL
    `;
    const params = [];
    if (startDate && endDate) {
      query += ` AND DATE(COALESCE(pl.production_date, pl.created_at)) BETWEEN ? AND ?`;
      params.push(startDate, endDate);
    }
    query += ` ORDER BY COALESCE(pl.production_date, pl.created_at) DESC`;
    const [rows] = await db_default.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error("Production Report Error:", error);
    return errorResponse(res, "Failed to fetch production report", 500, error);
  }
};
var getWastageReport = async (req, res) => {
  try {
    const { startDate, endDate, vendor_id, salesman_id } = req.query;
    const { brandId, branchId } = getReportScope2(req);
    let query = `
      SELECT w.*, 
             DATE_FORMAT(w.created_at, '%Y-%m-%d') as report_date,
             COALESCE(mi.name_en, p.name_en, ii.name_en, 'Unknown Item') as product_name, 
             COALESCE(mi.name_ar, p.name_ar, ii.name_ar, '\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641') as product_name_ar, 
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
    const params = [];
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
    const [rows] = await db_default.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error("Wastage Report Error:", error);
    return errorResponse(res, "Failed to fetch wastage report", 500, error);
  }
};
var getAnalyticsSummary = async (req, res) => {
  try {
    const { startDate, endDate, vendor_id, salesman_id } = req.query;
    const { brandId, branchId } = getReportScope2(req);
    const params = [];
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
    const queryParams = [...params];
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
    const [dailyTrend] = await db_default.execute(dailyQuery, queryParams);
    const [topCustomers] = await db_default.execute(customersQuery, queryParams);
    const [wastageReasons] = await db_default.execute(wastageQuery, wastageParams);
    return successResponse(res, {
      dailyTrend,
      topCustomers,
      wastageReasons
    });
  } catch (error) {
    console.error("Analytics Summary Error:", error);
    return errorResponse(res, "Failed to fetch analytics summary", 500, error);
  }
};
var getPurchaseReport = async (req, res) => {
  try {
    const { startDate, endDate, vendor_id } = req.query;
    const { brandId, branchId } = getReportScope2(req);
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
    if (branchId) {
      query += ` AND po.branch_id = ?`;
      params.push(branchId);
    }
    if (brandId) {
      query += ` AND po.brand_id = ?`;
      params.push(brandId);
    }
    query += ` ORDER BY po.date DESC, po.purchase_id DESC`;
    const [rows] = await db_default.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error("Purchase Report Error:", error);
    return errorResponse(res, "Failed to fetch purchase report", 500, error);
  }
};
var getProductPerformanceReport = async (req, res) => {
  try {
    const { startDate, endDate, vendor_id, salesman_id } = req.query;
    const { brandId, branchId } = getReportScope2(req);
    const subDateFilter = startDate && endDate ? "AND DATE(sr.created_at) BETWEEN ? AND ?" : "";
    const subVendorFilter = vendor_id ? "AND sr.vendor_id = ?" : "";
    const subBranchFilter = branchId ? "AND sr.branch_id = ?" : "";
    const subBrandFilter = brandId ? "AND sr.brand_id = ?" : "";
    const subSalesmanFilter = salesman_id ? "AND sr.salesman_id = ?" : "";
    let query = `
      SELECT 
        mi.menu_item_id,
        COALESCE(mi.name_en, 'Unnamed Product') as name_en,
        COALESCE(mi.name_ar, '\u0645\u0646\u062A\u062C \u063A\u064A\u0631 \u0645\u0633\u0645\u0649') as name_ar,
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
    const params = [];
    if (startDate && endDate) params.push(startDate, endDate);
    if (vendor_id) params.push(vendor_id);
    if (branchId) params.push(branchId);
    if (brandId) params.push(brandId);
    if (salesman_id) params.push(salesman_id);
    if (startDate && endDate) params.push(startDate, endDate);
    if (vendor_id) params.push(vendor_id);
    if (branchId) params.push(branchId);
    if (brandId) params.push(brandId);
    if (salesman_id) params.push(salesman_id);
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
    query += ` GROUP BY mi.menu_item_id ORDER BY total_sold DESC`;
    const [rows] = await db_default.execute(query, params);
    const totalRevenue = rows.reduce((acc, r) => acc + Number(r.revenue), 0);
    const enrichedRows = rows.map((r) => ({
      ...r,
      net_profit: (Number(r.revenue) - Number(r.total_cost) - Number(r.returns_loss)).toFixed(3),
      contribution: totalRevenue > 0 ? (Number(r.revenue) / totalRevenue * 100).toFixed(1) : 0,
      return_rate: r.total_sold > 0 ? (Number(r.returns_qty) / Number(r.total_sold) * 100).toFixed(1) : 0
    }));
    return successResponse(res, enrichedRows);
  } catch (error) {
    console.error("Product Performance Sales-Centric Error:", error);
    return errorResponse(res, "Failed to fetch product performance report", 500, error);
  }
};
var getFoodCostReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { brandId, branchId } = getReportScope2(req);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const start = startDate ? String(startDate) : new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0];
    const end = endDate ? String(endDate) : today;
    let itemsQuery = `
      SELECT ii.inventory_item_id, ii.name_en, ii.name_ar, ii.sku, ii.current_stock, ii.min_stock_level, ii.unit_en, ii.unit_ar, ii.cost_price,
      c.name_en as category_name
      FROM inventory_items ii
      LEFT JOIN categories c ON ii.category_id = c.category_id
      WHERE ii.deleted_at IS NULL
    `;
    const itemsParams = [];
    if (brandId) {
      itemsQuery += ` AND ii.brand_id = ?`;
      itemsParams.push(brandId);
    }
    itemsQuery += ` ORDER BY c.name_en ASC, ii.name_en ASC`;
    const [items] = await db_default.execute(itemsQuery, itemsParams);
    let recQuery = `
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) BETWEEN ? AND ?
    `;
    const recParams = [start, end];
    if (branchId) {
      recQuery += ` AND po.branch_id = ?`;
      recParams.push(branchId);
    }
    if (brandId) {
      recQuery += ` AND po.brand_id = ?`;
      recParams.push(brandId);
    }
    recQuery += ` GROUP BY poi.inventory_item_id`;
    const [receivingRows] = await db_default.execute(recQuery, recParams);
    const receivingMap = new Map(receivingRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    let wasteQuery = `
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      LEFT JOIN admins a ON w.admin_id = a.admin_id
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) BETWEEN ? AND ?
    `;
    const wasteParams = [start, end];
    if (branchId) {
      wasteQuery += ` AND (w.branch_id = ? OR a.branch_id = ?)`;
      wasteParams.push(branchId, branchId);
    }
    if (brandId) {
      wasteQuery += ` AND (w.brand_id = ? OR a.brand_id = ?)`;
      wasteParams.push(brandId, brandId);
    }
    wasteQuery += ` GROUP BY w.inventory_item_id`;
    const [wastageRows] = await db_default.execute(wasteQuery, wasteParams);
    const wastageMap = new Map(wastageRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    let prodQuery = `
      SELECT mii.inventory_item_id, SUM(pi.quantity_produced * mii.quantity * IFNULL(iip.multiplier, 1)) as total_qty
      FROM production_items pi
      JOIN production_logs pl ON pi.production_id = pl.production_id
      JOIN menu_item_ingredients mii ON pi.menu_item_id = mii.menu_item_id
      LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
      WHERE pl.deleted_at IS NULL
        AND DATE(pl.production_date) BETWEEN ? AND ?
    `;
    const prodParams = [start, end];
    if (branchId) {
      prodQuery += ` AND pl.branch_id = ?`;
      prodParams.push(branchId);
    }
    if (brandId) {
      prodQuery += ` AND pl.brand_id = ?`;
      prodParams.push(brandId);
    }
    prodQuery += ` GROUP BY mii.inventory_item_id`;
    const [productionRows] = await db_default.execute(prodQuery, prodParams);
    const productionMap = new Map(productionRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    let recSinceStartQuery = `
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) >= ?
    `;
    const recSinceStartParams = [start];
    if (branchId) {
      recSinceStartQuery += ` AND po.branch_id = ?`;
      recSinceStartParams.push(branchId);
    }
    if (brandId) {
      recSinceStartQuery += ` AND po.brand_id = ?`;
      recSinceStartParams.push(brandId);
    }
    recSinceStartQuery += ` GROUP BY poi.inventory_item_id`;
    const [recSinceStartRows] = await db_default.execute(recSinceStartQuery, recSinceStartParams);
    const recSinceStartMap = new Map(recSinceStartRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    let wasteSinceStartQuery = `
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      LEFT JOIN admins a ON w.admin_id = a.admin_id
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) >= ?
    `;
    const wasteSinceStartParams = [start];
    if (branchId) {
      wasteSinceStartQuery += ` AND (w.branch_id = ? OR a.branch_id = ?)`;
      wasteSinceStartParams.push(branchId, branchId);
    }
    if (brandId) {
      wasteSinceStartQuery += ` AND (w.brand_id = ? OR a.brand_id = ?)`;
      wasteSinceStartParams.push(brandId, brandId);
    }
    wasteSinceStartQuery += ` GROUP BY w.inventory_item_id`;
    const [wasteSinceStartRows] = await db_default.execute(wasteSinceStartQuery, wasteSinceStartParams);
    const wasteSinceStartMap = new Map(wasteSinceStartRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    let prodSinceStartQuery = `
      SELECT mii.inventory_item_id, SUM(pi.quantity_produced * mii.quantity * IFNULL(iip.multiplier, 1)) as total_qty
      FROM production_items pi
      JOIN production_logs pl ON pi.production_id = pl.production_id
      JOIN menu_item_ingredients mii ON pi.menu_item_id = mii.menu_item_id
      LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
      WHERE pl.deleted_at IS NULL
        AND DATE(pl.production_date) >= ?
    `;
    const prodSinceStartParams = [start];
    if (branchId) {
      prodSinceStartQuery += ` AND pl.branch_id = ?`;
      prodSinceStartParams.push(branchId);
    }
    if (brandId) {
      prodSinceStartQuery += ` AND pl.brand_id = ?`;
      prodSinceStartParams.push(brandId);
    }
    prodSinceStartQuery += ` GROUP BY mii.inventory_item_id`;
    const [prodSinceStartRows] = await db_default.execute(prodSinceStartQuery, prodSinceStartParams);
    const prodSinceStartMap = new Map(prodSinceStartRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    let recAfterEndQuery = `
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) > ?
    `;
    const recAfterEndParams = [end];
    if (branchId) {
      recAfterEndQuery += ` AND po.branch_id = ?`;
      recAfterEndParams.push(branchId);
    }
    if (brandId) {
      recAfterEndQuery += ` AND po.brand_id = ?`;
      recAfterEndParams.push(brandId);
    }
    recAfterEndQuery += ` GROUP BY poi.inventory_item_id`;
    const [recAfterEndRows] = await db_default.execute(recAfterEndQuery, recAfterEndParams);
    const recAfterEndMap = new Map(recAfterEndRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    let wasteAfterEndQuery = `
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      LEFT JOIN admins a ON w.admin_id = a.admin_id
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) > ?
    `;
    const wasteAfterEndParams = [end];
    if (branchId) {
      wasteAfterEndQuery += ` AND (w.branch_id = ? OR a.branch_id = ?)`;
      wasteAfterEndParams.push(branchId, branchId);
    }
    if (brandId) {
      wasteAfterEndQuery += ` AND (w.brand_id = ? OR a.brand_id = ?)`;
      wasteAfterEndParams.push(brandId, brandId);
    }
    wasteAfterEndQuery += ` GROUP BY w.inventory_item_id`;
    const [wasteAfterEndRows] = await db_default.execute(wasteAfterEndQuery, wasteAfterEndParams);
    const wasteAfterEndMap = new Map(wasteAfterEndRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    let prodAfterEndQuery = `
      SELECT mii.inventory_item_id, SUM(pi.quantity_produced * mii.quantity * IFNULL(iip.multiplier, 1)) as total_qty
      FROM production_items pi
      JOIN production_logs pl ON pi.production_id = pl.production_id
      JOIN menu_item_ingredients mii ON pi.menu_item_id = mii.menu_item_id
      LEFT JOIN inventory_item_packages iip ON mii.package_id = iip.package_id
      WHERE pl.deleted_at IS NULL
        AND DATE(pl.production_date) > ?
    `;
    const prodAfterEndParams = [end];
    if (branchId) {
      prodAfterEndQuery += ` AND pl.branch_id = ?`;
      prodAfterEndParams.push(branchId);
    }
    if (brandId) {
      prodAfterEndQuery += ` AND pl.brand_id = ?`;
      prodAfterEndParams.push(brandId);
    }
    prodAfterEndQuery += ` GROUP BY mii.inventory_item_id`;
    const [prodAfterEndRows] = await db_default.execute(prodAfterEndQuery, prodAfterEndParams);
    const prodAfterEndMap = new Map(prodAfterEndRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    const reportData = items.map((item) => {
      const itemId = item.inventory_item_id;
      const receivingQty = receivingMap.get(itemId) || 0;
      const wastageQty = wastageMap.get(itemId) || 0;
      const productionQty = productionMap.get(itemId) || 0;
      const recSinceStart = Number(recSinceStartMap.get(itemId) || 0);
      const wasteSinceStart = Number(wasteSinceStartMap.get(itemId) || 0);
      const prodSinceStart = Number(prodSinceStartMap.get(itemId) || 0);
      const openingStock = Math.max(0, parseFloat(item.current_stock) - recSinceStart + wasteSinceStart + prodSinceStart);
      const recAfterEnd = Number(recAfterEndMap.get(itemId) || 0);
      const wasteAfterEnd = Number(wasteAfterEndMap.get(itemId) || 0);
      const prodAfterEnd = Number(prodAfterEndMap.get(itemId) || 0);
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
        current_stock: closingStock
        // now represents end-of-period stock, not live stock
      };
    });
    let salesQuery = `
      SELECT SUM(total_amount) as revenue
      FROM sales_orders
      WHERE deleted_at IS NULL
        AND DATE(created_at) BETWEEN ? AND ?
    `;
    const salesParams = [start, end];
    if (branchId) {
      salesQuery += ` AND branch_id = ?`;
      salesParams.push(branchId);
    }
    if (brandId) {
      salesQuery += ` AND brand_id = ?`;
      salesParams.push(brandId);
    }
    const [salesRows] = await db_default.execute(salesQuery, salesParams);
    const salesRevenue = parseFloat(salesRows[0]?.revenue || 0);
    return successResponse(res, {
      items: reportData,
      sales_revenue: salesRevenue
    });
  } catch (error) {
    console.error("Food Cost Report Error:", error);
    return errorResponse(res, "Failed to fetch food cost report", 500, error);
  }
};
var getClientStatements = async (req, res) => {
  try {
    const { startDate, endDate, vendor_id } = req.query;
    const { brandId, branchId } = getReportScope2(req);
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
    if (branchId) {
      query += ` AND s.branch_id = ?`;
      params.push(branchId);
    }
    if (brandId) {
      query += ` AND s.brand_id = ?`;
      params.push(brandId);
    }
    query += ` ORDER BY s.created_at DESC, s.sale_id DESC`;
    const [orders] = await db_default.execute(query, params);
    if (orders.length === 0) {
      return successResponse(res, []);
    }
    const orderIds = orders.map((o) => o.sale_id);
    const placeholders = orderIds.map(() => "?").join(",");
    const [items] = await db_default.execute(`
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
  } catch (error) {
    console.error("Client Statements Error:", error);
    return errorResponse(res, "Failed to fetch client statements", 500, error);
  }
};
var getOperationalPNL = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { brandId, branchId } = getReportScope2(req);
    let dateFilter = "";
    let params = [];
    if (startDate && endDate) {
      dateFilter = "AND DATE(created_at) BETWEEN ? AND ?";
      params = [startDate, endDate];
    }
    let salesQuery = `
      SELECT 
        COALESCE(c.name_en, 'Uncategorized') as category_name, 
        SUM(soi.quantity * soi.price) as total_sales, 
        SUM(soi.quantity * COALESCE(mi.cost_price, 0)) as total_cogs
      FROM sales_order_items soi
      JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
      LEFT JOIN categories c ON mi.category_id = c.category_id
      JOIN sales_orders s ON soi.sale_id = s.sale_id
      WHERE s.deleted_at IS NULL ${dateFilter.replace("created_at", "s.created_at")}
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
    const [salesRaw] = await db_default.execute(salesQuery, salesParams);
    let returnsQuery = `
      SELECT 
        COALESCE(c.name_en, 'Uncategorized') as category_name, 
        SUM(sri.quantity * COALESCE(mi.price, 0)) as total_returns, 
        SUM(sri.quantity * COALESCE(mi.cost_price, 0)) as return_cogs
      FROM sales_return_items sri
      JOIN menu_items mi ON sri.menu_item_id = mi.menu_item_id
      LEFT JOIN categories c ON mi.category_id = c.category_id
      JOIN sales_returns sr ON sri.return_id = sr.return_id
      WHERE 1=1 ${dateFilter.replace("created_at", "sr.created_at")}
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
    const [returnsRaw] = await db_default.execute(returnsQuery, returnsParams);
    const salesMap = /* @__PURE__ */ new Map();
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
      } else {
        salesMap.set(row.category_name, {
          category: row.category_name,
          sales: -Number(row.total_returns),
          cogs: -Number(row.return_cogs)
        });
      }
    });
    const salesByCategory = Array.from(salesMap.values());
    let employeesQuery = `
      SELECT role as category, SUM(salary) as amount 
      FROM employees 
      WHERE deleted_at IS NULL AND status = 'active'
    `;
    const employeesParams = [];
    if (branchId) {
      employeesQuery += ` AND branch_id = ?`;
      employeesParams.push(branchId);
    }
    if (brandId) {
      employeesQuery += ` AND brand_id = ?`;
      employeesParams.push(brandId);
    }
    employeesQuery += ` GROUP BY role`;
    const [laborRaw] = await db_default.execute(employeesQuery, employeesParams);
    const laborExpenses = laborRaw.map((e) => ({ category: e.category, amount: Number(e.amount) }));
    let expensesQuery = `
      SELECT category, SUM(amount) as total
      FROM operational_expenses
      WHERE type = 'Other Expense' ${dateFilter.replace("created_at", "expense_date")}
    `;
    const expensesParams = [...params];
    if (branchId) {
      expensesQuery += ` AND branch_id = ?`;
      expensesParams.push(branchId);
    }
    if (brandId) {
      expensesQuery += ` AND brand_id = ?`;
      expensesParams.push(brandId);
    }
    expensesQuery += ` GROUP BY category`;
    const [expensesRaw] = await db_default.execute(expensesQuery, expensesParams);
    const otherExpenses = expensesRaw.map((e) => ({ category: e.category, amount: Number(e.total) }));
    let assetsQuery = `SELECT name, value, depreciation_rate FROM company_assets WHERE 1=1`;
    const assetsParams = [];
    if (branchId) {
      assetsQuery += ` AND branch_id = ?`;
      assetsParams.push(branchId);
    }
    if (brandId) {
      assetsQuery += ` AND brand_id = ?`;
      assetsParams.push(brandId);
    }
    const [assetsRaw] = await db_default.execute(assetsQuery, assetsParams);
    let totalMonthlyDepreciation = 0;
    assetsRaw.forEach((asset) => {
      const val = Number(asset.value) || 0;
      const rate = Number(asset.depreciation_rate) || 0;
      if (val > 0 && rate > 0) {
        const monthlyDepreciation = val * (rate / 100) / 12;
        totalMonthlyDepreciation += monthlyDepreciation;
      }
    });
    if (totalMonthlyDepreciation > 0) {
      otherExpenses.push({
        category: "Asset Depreciation (Monthly)",
        amount: totalMonthlyDepreciation
      });
    }
    let liabilitiesQuery = `SELECT name, amount, interest_rate FROM company_liabilities WHERE 1=1`;
    const liabilitiesParams = [];
    if (branchId) {
      liabilitiesQuery += ` AND branch_id = ?`;
      liabilitiesParams.push(branchId);
    }
    if (brandId) {
      liabilitiesQuery += ` AND brand_id = ?`;
      liabilitiesParams.push(brandId);
    }
    const [liabilitiesRaw] = await db_default.execute(liabilitiesQuery, liabilitiesParams);
    let totalMonthlyInterest = 0;
    liabilitiesRaw.forEach((liability) => {
      const amt = Number(liability.amount) || 0;
      const rawRate = liability.interest_rate || "";
      const rateNum = parseFloat(rawRate.toString().replace("%", ""));
      if (amt > 0 && !isNaN(rateNum) && rateNum > 0) {
        const monthlyInterest = amt * (rateNum / 100) / 12;
        totalMonthlyInterest += monthlyInterest;
      }
    });
    if (totalMonthlyInterest > 0) {
      otherExpenses.push({
        category: "Liability Interest (Monthly)",
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
  } catch (error) {
    console.error("Operational PNL Error:", error);
    return errorResponse(res, "Failed to generate operational PNL", 500, error);
  }
};

// src/routes/reports.routes.ts
var router15 = Router15();
router15.get("/sales", authMiddleware, getSalesReport);
router15.get("/production", authMiddleware, getProductionReport);
router15.get("/wastage", authMiddleware, getWastageReport);
router15.get("/purchase", authMiddleware, getPurchaseReport);
router15.get("/products", authMiddleware, getProductPerformanceReport);
router15.get("/analytics", authMiddleware, getAnalyticsSummary);
router15.get("/food-cost", authMiddleware, getFoodCostReport);
router15.get("/client-statements", authMiddleware, getClientStatements);
router15.get("/store-pnl", authMiddleware, getOperationalPNL);
var reports_routes_default = router15;

// src/routes/salesman.routes.ts
import { Router as Router16 } from "express";

// src/controllers/salesman.controller.ts
init_db();
var getSalesmen = async (req, res) => {
  try {
    const [rows] = await db_default.execute("SELECT * FROM salesmen WHERE deleted_at IS NULL ORDER BY name_en ASC");
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
var getSalesmanById = async (req, res) => {
  try {
    const [rows] = await db_default.execute("SELECT * FROM salesmen WHERE salesman_id = ? AND deleted_at IS NULL", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Salesman not found" });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
var createSalesman = async (req, res) => {
  const { name_en, name_ar, phone, email, commission_rate } = req.body;
  try {
    const [result] = await db_default.execute(
      "INSERT INTO salesmen (name_en, name_ar, phone, email, commission_rate) VALUES (?, ?, ?, ?, ?)",
      [name_en, name_ar, phone, email, commission_rate || 0]
    );
    res.status(201).json({ success: true, data: { salesman_id: result.insertId, ...req.body } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
var updateSalesman = async (req, res) => {
  const { name_en, name_ar, phone, email, commission_rate, status } = req.body;
  try {
    await db_default.execute(
      "UPDATE salesmen SET name_en = ?, name_ar = ?, phone = ?, email = ?, commission_rate = ?, status = ? WHERE salesman_id = ?",
      [name_en, name_ar, phone, email, commission_rate, status, req.params.id]
    );
    res.json({ success: true, message: "Salesman updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
var deleteSalesman = async (req, res) => {
  try {
    await db_default.execute("UPDATE salesmen SET deleted_at = NOW() WHERE salesman_id = ?", [req.params.id]);
    res.json({ success: true, message: "Salesman deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
var getSalesmanPerformance = async (req, res) => {
  try {
    const [rows] = await db_default.execute(`
            SELECT 
                s.salesman_id,
                s.name_en,
                COUNT(so.sale_id) as total_orders,
                SUM(so.total_amount) as total_revenue,
                SUM(so.total_amount * (s.commission_rate / 100)) as estimated_commission
            FROM salesmen s
            LEFT JOIN sales_orders so ON s.salesman_id = so.salesman_id AND so.deleted_at IS NULL
            WHERE s.deleted_at IS NULL
            GROUP BY s.salesman_id
        `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// src/routes/salesman.routes.ts
var router16 = Router16();
router16.use(authMiddleware);
router16.get("/", getSalesmen);
router16.get("/performance", getSalesmanPerformance);
router16.get("/:id", getSalesmanById);
router16.post("/", createSalesman);
router16.put("/:id", updateSalesman);
router16.delete("/:id", deleteSalesman);
var salesman_routes_default = router16;

// src/routes/assetsRoutes.ts
import express from "express";

// src/controllers/assetsController.ts
init_db();
var getAssets = async (req, res) => {
  try {
    const [rows] = await db_default.query("SELECT * FROM company_assets ORDER BY created_at DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch assets", error });
  }
};
var createAsset = async (req, res) => {
  const { name, type, value, depreciation_rate, date_acquired } = req.body;
  try {
    const [result] = await db_default.query(
      "INSERT INTO company_assets (name, type, value, depreciation_rate, date_acquired) VALUES (?, ?, ?, ?, ?)",
      [name, type || "General", value, depreciation_rate || 0, date_acquired || /* @__PURE__ */ new Date()]
    );
    res.status(201).json({ success: true, data: { asset_id: result.insertId, name, type, value, depreciation_rate, date_acquired } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create asset", error });
  }
};
var updateAsset = async (req, res) => {
  const { id } = req.params;
  const { name, type, value, depreciation_rate, date_acquired } = req.body;
  try {
    await db_default.query(
      "UPDATE company_assets SET name=?, type=?, value=?, depreciation_rate=?, date_acquired=? WHERE asset_id=?",
      [name, type, value, depreciation_rate, date_acquired, id]
    );
    res.json({ success: true, message: "Asset updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update asset", error });
  }
};

// src/routes/assetsRoutes.ts
var router17 = express.Router();
router17.get("/", getAssets);
router17.post("/", createAsset);
router17.put("/:id", updateAsset);
var assetsRoutes_default = router17;

// src/routes/liabilitiesRoutes.ts
import express2 from "express";

// src/controllers/liabilitiesController.ts
init_db();
var getLiabilities = async (req, res) => {
  try {
    const [rows] = await db_default.query("SELECT * FROM company_liabilities ORDER BY created_at DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch liabilities", error });
  }
};
var createLiability = async (req, res) => {
  const { name, type, amount, interest_rate, due_date } = req.body;
  try {
    const [result] = await db_default.query(
      "INSERT INTO company_liabilities (name, type, amount, interest_rate, due_date) VALUES (?, ?, ?, ?, ?)",
      [name, type || "Loan", amount, interest_rate || "0%", due_date || null]
    );
    res.status(201).json({ success: true, data: { liability_id: result.insertId, name, type, amount, interest_rate, due_date } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create liability", error });
  }
};
var updateLiability = async (req, res) => {
  const { id } = req.params;
  const { name, type, amount, interest_rate, due_date } = req.body;
  try {
    await db_default.query(
      "UPDATE company_liabilities SET name=?, type=?, amount=?, interest_rate=?, due_date=? WHERE liability_id=?",
      [name, type, amount, interest_rate, due_date, id]
    );
    res.json({ success: true, message: "Liability updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update liability", error });
  }
};

// src/routes/liabilitiesRoutes.ts
var router18 = express2.Router();
router18.get("/", getLiabilities);
router18.post("/", createLiability);
router18.put("/:id", updateLiability);
var liabilitiesRoutes_default = router18;

// src/routes/employeesRoutes.ts
import express3 from "express";

// src/controllers/employeesController.ts
init_db();
var getEmployees = async (req, res) => {
  try {
    const [rows] = await db_default.query("SELECT * FROM employees WHERE deleted_at IS NULL ORDER BY created_at DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch employees", error });
  }
};
var createEmployee = async (req, res) => {
  const { name, role, salary, allowances, employee_no } = req.body;
  try {
    const allowancesJson = allowances ? JSON.stringify(allowances) : null;
    const [result] = await db_default.query(
      "INSERT INTO employees (employee_no, name, role, salary, allowances) VALUES (?, ?, ?, ?, ?)",
      [employee_no || null, name, role || "Staff", salary || 0, allowancesJson]
    );
    res.status(201).json({ success: true, data: { employee_id: result.insertId, employee_no, name, role, salary, allowances, status: "active" } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create employee", error });
  }
};
var updateEmployee = async (req, res) => {
  const { id } = req.params;
  const { name, role, salary, allowances, status, employee_no } = req.body;
  try {
    const allowancesJson = allowances ? JSON.stringify(allowances) : null;
    await db_default.query(
      "UPDATE employees SET employee_no=?, name=?, role=?, salary=?, allowances=?, status=? WHERE employee_id=?",
      [employee_no || null, name, role, salary, allowancesJson, status || "active", id]
    );
    res.json({ success: true, message: "Employee updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update employee", error });
  }
};
var deleteEmployee = async (req, res) => {
  const { id } = req.params;
  try {
    await db_default.query("UPDATE employees SET deleted_at = CURRENT_TIMESTAMP WHERE employee_id = ?", [id]);
    res.json({ success: true, message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete employee", error });
  }
};

// src/routes/employeesRoutes.ts
var router19 = express3.Router();
router19.get("/", getEmployees);
router19.post("/", createEmployee);
router19.put("/:id", updateEmployee);
router19.delete("/:id", deleteEmployee);
var employeesRoutes_default = router19;

// src/routes/expense.routes.ts
import { Router as Router17 } from "express";

// src/controllers/expense.controller.ts
init_db();
var getExpenses = async (req, res) => {
  try {
    const [rows] = await db_default.execute("SELECT * FROM operational_expenses ORDER BY expense_date DESC, created_at DESC");
    return successResponse(res, rows);
  } catch (error) {
    return errorResponse(res, "Failed to fetch expenses", 500, error);
  }
};
var createExpense = async (req, res) => {
  try {
    const { type, category, amount, expense_date, description } = req.body;
    if (!type || !category || !amount || !expense_date) {
      return errorResponse(res, "Missing required fields", 400);
    }
    const [result] = await db_default.execute(
      "INSERT INTO operational_expenses (type, category, amount, expense_date, description) VALUES (?, ?, ?, ?, ?)",
      [type, category, amount, expense_date, description || null]
    );
    return successResponse(res, { expense_id: result.insertId }, "Expense logged successfully", 201);
  } catch (error) {
    return errorResponse(res, "Failed to create expense", 500, error);
  }
};
var deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    await db_default.execute("DELETE FROM operational_expenses WHERE expense_id = ?", [id]);
    return successResponse(res, null, "Expense deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete expense", 500, error);
  }
};

// src/routes/expense.routes.ts
var router20 = Router17();
router20.get("/", authMiddleware, getExpenses);
router20.post("/", authMiddleware, createExpense);
router20.delete("/:id", authMiddleware, deleteExpense);
var expense_routes_default = router20;

// src/routes/ai.routes.ts
import { Router as Router18 } from "express";

// src/controllers/ai.controller.ts
init_db();
import { GoogleGenAI, Type } from "@google/genai";
var ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
var getMenuCatalogDeclaration = {
  name: "getMenuCatalog",
  description: "Get the catalog of menu items with prices. Use this to answer questions about the menu or item prices."
};
var getSalesSummaryDeclaration = {
  name: "getSalesSummary",
  description: "Get the summary of total sales, total revenue, and loss rate for a given date range. Use this for sales forecasting or answering sales inquiries.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      period: {
        type: Type.STRING,
        description: 'The period to get sales for. Can be "today", "this_month", "all_time", or a specific month name like "May".'
      },
      client_name: {
        type: Type.STRING,
        description: 'Optional. The specific client or customer name to get sales for (e.g. "canteen", "john").'
      }
    },
    required: ["period"]
  }
};
var getBranchPerformanceDeclaration = {
  name: "getBranchPerformance",
  description: "Get the sales performance (total revenue and orders) grouped by branches. Use this to answer which branch is performing best or worst.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};
var getMenuCatalog = async () => {
  try {
    const [rows] = await db_default.query('SELECT name_en, name_ar, price, category FROM menu_items WHERE status = "active" LIMIT 50');
    return rows;
  } catch (e) {
    return { error: "Failed to fetch menu" };
  }
};
var getSalesSummary = async (args) => {
  try {
    let dateCondition = "1=1";
    if (args.period === "today") {
      dateCondition = "DATE(created_at) = CURDATE()";
    } else if (args.period === "this_month") {
      dateCondition = "MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())";
    } else if (args.period && args.period !== "all_time") {
      const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
      const monthIndex = months.findIndex((m) => args.period.toLowerCase().includes(m));
      if (monthIndex !== -1) {
        dateCondition = `MONTH(created_at) = ${monthIndex + 1} AND YEAR(created_at) = YEAR(CURDATE())`;
      }
    }
    let query = `SELECT COUNT(*) as total_orders, SUM(total_amount) as total_revenue FROM sales_orders WHERE ${dateCondition} AND status != 'cancelled'`;
    const queryParams = [];
    if (args.client_name) {
      query += ` AND customer_name LIKE ?`;
      queryParams.push(`%${args.client_name}%`);
    }
    const [salesRows] = await db_default.query(query, queryParams);
    return {
      total_orders: salesRows[0].total_orders || 0,
      total_revenue: salesRows[0].total_revenue || 0,
      currency: "KWD",
      loss_rate: "2.5%"
    };
  } catch (e) {
    return { error: "Failed to fetch sales summary" };
  }
};
var getBranchPerformance = async () => {
  try {
    const query = `
            SELECT b.name_en as branch_name, COUNT(s.sale_id) as total_orders, SUM(s.total_amount) as total_revenue
            FROM sales_orders s
            LEFT JOIN branches b ON s.branch_id = b.branch_id
            WHERE s.status != 'cancelled'
            GROUP BY s.branch_id, b.name_en
            ORDER BY total_revenue DESC
        `;
    const [rows] = await db_default.query(query);
    return rows;
  } catch (e) {
    return { error: "Failed to fetch branch performance" };
  }
};
var tools = [getMenuCatalogDeclaration, getSalesSummaryDeclaration, getBranchPerformanceDeclaration];
var functions = {
  getMenuCatalog,
  getSalesSummary,
  getBranchPerformance
};
var chatWithAI = async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ success: false, message: "GEMINI_API_KEY is not configured in the backend." });
    }
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, message: "Invalid messages format" });
    }
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }]
    }));
    const userMessage = messages[messages.length - 1].text;
    const [settingsRows] = await db_default.execute(
      "SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('company_name', 'currency_code')"
    );
    const systemConfigs = (settingsRows || []).reduce((acc, curr) => {
      acc[curr.setting_key] = curr.setting_value;
      return acc;
    }, { company_name: "KMS", currency_code: "KWD" });
    const companyName = systemConfigs.company_name;
    const currencyCode = systemConfigs.currency_code;
    const chat = ai.chats.create({
      model: "gemini-flash-lite-latest",
      config: {
        systemInstruction: `You are the ${companyName} ERP Personal Assistant. Answer questions accurately and concisely. Use tools to query system data when asked about menu, prices, or sales. For general questions like recipes, provide standard information but mention prices in ${currencyCode} where appropriate. Respond in the same language as the user (English or Arabic).`,
        tools: [{ functionDeclarations: tools }]
      }
    });
    if (history.length > 0) {
    }
    let response = await chat.sendMessage({ message: userMessage });
    if (response.functionCalls && response.functionCalls.length > 0) {
      const toolResults = [];
      for (const call of response.functionCalls) {
        if (call.name && functions[call.name]) {
          const func = functions[call.name];
          const result = await func(call.args);
          toolResults.push({
            functionResponse: {
              name: call.name,
              response: { result }
            }
          });
        }
      }
      response = await chat.sendMessage({ message: toolResults });
    }
    return res.json({ success: true, text: response.text });
  } catch (error) {
    console.error("AI Chat Error:", error);
    return res.status(500).json({ success: false, message: "AI processing failed", error: error.message });
  }
};

// src/routes/ai.routes.ts
var router21 = Router18();
router21.post("/chat", chatWithAI);
var ai_routes_default = router21;

// src/routes/transfer.routes.ts
import { Router as Router19 } from "express";

// src/controllers/transfer.controller.ts
init_db();
var getTransfers = async (req, res) => {
  try {
    const user = req.user;
    let query = `
      SELECT t.*, 
             b1.name_en as from_branch_name, 
             b2.name_en as to_branch_name,
             a.first_name as created_by_name
      FROM stock_transfers t
      LEFT JOIN branches b1 ON t.from_branch_id = b1.branch_id
      LEFT JOIN branches b2 ON t.to_branch_id = b2.branch_id
      LEFT JOIN admins a ON t.created_by = a.admin_id
    `;
    const params = [];
    if (user && user.brand_id) {
      query += ` WHERE (b1.brand_id = ? OR b2.brand_id = ? OR t.from_branch_id IS NULL)`;
      params.push(user.brand_id, user.brand_id);
    } else if (user && user.branch_id) {
      query += ` WHERE (t.from_branch_id = ? OR t.to_branch_id = ?)`;
      params.push(user.branch_id, user.branch_id);
    }
    query += " ORDER BY t.created_at DESC";
    const [rows] = await db_default.execute(query, params);
    if (rows.length > 0) {
      const transferIds = rows.map((r) => r.transfer_id);
      const [items] = await db_default.execute(`
        SELECT ti.*, ii.name_en, ii.name_ar, ii.unit_en
        FROM stock_transfer_items ti
        JOIN inventory_items ii ON ti.inventory_item_id = ii.inventory_item_id
        WHERE ti.transfer_id IN (${transferIds.join(",")})
      `);
      rows.forEach((row) => {
        row.items = items.filter((i) => i.transfer_id === row.transfer_id);
      });
    }
    return successResponse(res, rows);
  } catch (error) {
    console.error("getTransfers Error:", error);
    return errorResponse(res, "Failed to fetch transfers", 500, error);
  }
};
var createTransfer = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const user = req.user;
    const { from_branch_id, to_branch_id, notes, items } = req.body;
    const admin_id = user?.admin_id || 1;
    if (!to_branch_id) {
      return errorResponse(res, "Destination branch is required", 400);
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, "Transfer items are required", 400);
    }
    const [result] = await connection.execute(
      "INSERT INTO stock_transfers (from_branch_id, to_branch_id, notes, created_by, status) VALUES (?, ?, ?, ?, ?)",
      [from_branch_id || null, to_branch_id, notes || null, admin_id, "pending"]
    );
    const transfer_id = result.insertId;
    for (const item of items) {
      await connection.execute(
        "INSERT INTO stock_transfer_items (transfer_id, inventory_item_id, quantity) VALUES (?, ?, ?)",
        [transfer_id, item.inventory_item_id, item.quantity]
      );
    }
    await connection.commit();
    return successResponse(res, { transfer_id }, "Stock transfer requested successfully", 201);
  } catch (error) {
    await connection.rollback();
    console.error("createTransfer Error:", error);
    return errorResponse(res, "Failed to request stock transfer", 500, error);
  } finally {
    connection.release();
  }
};
var updateTransferStatus = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;
    const { status } = req.body;
    if (!["completed", "cancelled"].includes(status)) {
      return errorResponse(res, "Invalid status update", 400);
    }
    const [transfers] = await connection.execute("SELECT * FROM stock_transfers WHERE transfer_id = ?", [id]);
    if (transfers.length === 0) {
      return errorResponse(res, "Transfer request not found", 404);
    }
    const transfer = transfers[0];
    if (transfer.status !== "pending") {
      return errorResponse(res, "Transfer is already processed", 400);
    }
    if (status === "completed") {
      const [items] = await connection.execute("SELECT * FROM stock_transfer_items WHERE transfer_id = ?", [id]);
      const sourceBranchId = transfer.from_branch_id || 1;
      for (const item of items) {
        const [sourceStock] = await connection.execute(
          "SELECT quantity FROM branch_stock WHERE branch_id = ? AND inventory_item_id = ?",
          [sourceBranchId, item.inventory_item_id]
        );
        const currentQty = sourceStock && sourceStock.length > 0 ? Number(sourceStock[0].quantity) : 0;
        if (currentQty < Number(item.quantity) && transfer.from_branch_id !== null) {
          await connection.rollback();
          return errorResponse(res, `Insufficient stock for item ID ${item.inventory_item_id} in source branch. Available: ${currentQty}`, 400);
        }
        await connection.execute(
          "INSERT INTO branch_stock (branch_id, inventory_item_id, quantity) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE quantity = quantity",
          [sourceBranchId, item.inventory_item_id]
        );
        await connection.execute(
          "UPDATE branch_stock SET quantity = quantity - ? WHERE branch_id = ? AND inventory_item_id = ?",
          [item.quantity, sourceBranchId, item.inventory_item_id]
        );
        await connection.execute(
          "INSERT INTO branch_stock (branch_id, inventory_item_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?",
          [transfer.to_branch_id, item.inventory_item_id, item.quantity, item.quantity]
        );
      }
    }
    await connection.execute("UPDATE stock_transfers SET status = ? WHERE transfer_id = ?", [status, id]);
    await connection.commit();
    return successResponse(res, null, `Stock transfer marked as ${status} successfully`);
  } catch (error) {
    await connection.rollback();
    console.error("updateTransferStatus Error:", error);
    return errorResponse(res, "Failed to update stock transfer status", 500, error);
  } finally {
    connection.release();
  }
};

// src/routes/transfer.routes.ts
var router22 = Router19();
router22.use(authMiddleware);
router22.get("/", getTransfers);
router22.post("/", authorize(["super_admin", "manager"]), createTransfer);
router22.put("/:id/status", authorize(["super_admin", "manager"]), updateTransferStatus);
var transfer_routes_default = router22;

// src/routes/brand.routes.ts
import { Router as Router20 } from "express";

// src/controllers/brand.controller.ts
init_db();
var getBrands = async (req, res) => {
  try {
    const user = req.user;
    let query = "SELECT * FROM brands WHERE deleted_at IS NULL";
    const params = [];
    if (user && user.brand_id) {
      query += " AND brand_id = ?";
      params.push(user.brand_id);
    }
    query += " ORDER BY name_en";
    const [brands] = await db_default.execute(query, params);
    return successResponse(res, brands);
  } catch (error) {
    return errorResponse(res, "Failed to fetch brands", 500, error);
  }
};
var createBrand = async (req, res) => {
  try {
    const { name_en, name_ar, status } = req.body;
    if (!name_en || !name_ar) {
      return errorResponse(res, "Brand English and Arabic names are required", 400);
    }
    const [result] = await db_default.execute(
      "INSERT INTO brands (name_en, name_ar, status) VALUES (?, ?, ?)",
      [name_en, name_ar, status || "active"]
    );
    return successResponse(res, { brand_id: result.insertId }, "Brand created successfully", 201);
  } catch (error) {
    return errorResponse(res, "Failed to create brand", 500, error);
  }
};
var updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_en, name_ar, status } = req.body;
    await db_default.execute(
      "UPDATE brands SET name_en = ?, name_ar = ?, status = ? WHERE brand_id = ?",
      [name_en, name_ar, status || "active", id]
    );
    return successResponse(res, null, "Brand updated successfully");
  } catch (error) {
    return errorResponse(res, "Failed to update brand", 500, error);
  }
};
var deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    await db_default.execute("UPDATE brands SET deleted_at = CURRENT_TIMESTAMP WHERE brand_id = ?", [id]);
    return successResponse(res, null, "Brand deleted successfully");
  } catch (error) {
    return errorResponse(res, "Failed to delete brand", 500, error);
  }
};

// src/routes/brand.routes.ts
var router23 = Router20();
router23.use(authMiddleware);
router23.get("/", getBrands);
router23.post("/", authorize(["super_admin", "manager"]), createBrand);
router23.put("/:id", authorize(["super_admin", "manager"]), updateBrand);
router23.delete("/:id", authorize(["super_admin"]), deleteBrand);
var brand_routes_default = router23;

// src/routes/subscription.routes.ts
import { Router as Router21 } from "express";

// src/controllers/subscription.controller.ts
init_db();

// src/config/razorpay.ts
init_config();
import Razorpay from "razorpay";
var razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret
});
var razorpay_default = razorpay;

// src/controllers/subscription.controller.ts
import crypto from "crypto";
init_config();
var PRICE_BASE_YEARLY_USD = 650;
var PRICE_BRANCH_YEARLY_USD = 325;
var PRICE_COUNTER_YEARLY_USD = 160;
var PRICE_USER_YEARLY_USD = 160;
var getSubscriptionStatus = async (req, res) => {
  const dbName = req.user?.tenant_db;
  if (!dbName || dbName === "kms_master") {
    return errorResponse(res, "Invalid tenant context", 400);
  }
  try {
    const [tenants] = await masterPool.execute(
      "SELECT * FROM tenants WHERE db_name = ?",
      [dbName]
    );
    if (!tenants || tenants.length === 0) {
      return errorResponse(res, "Tenant not found", 404);
    }
    const t = tenants[0];
    const [branchesRes] = await db_default.execute("SELECT COUNT(*) as count FROM branches WHERE deleted_at IS NULL");
    const [usersRes] = await db_default.execute("SELECT COUNT(*) as count FROM admins WHERE deleted_at IS NULL");
    let countersCount = 0;
    try {
      const [countersRes] = await db_default.execute("SELECT COUNT(*) as count FROM pos_counters WHERE deleted_at IS NULL");
      countersCount = countersRes[0].count;
    } catch (e) {
    }
    const branchesCount = branchesRes[0].count;
    const usersCount = usersRes[0].count;
    let remainingDays = 0;
    if (t.plan_end_date) {
      const endMs = new Date(t.plan_end_date).getTime();
      const nowMs = Date.now();
      remainingDays = Math.max(0, Math.ceil((endMs - nowMs) / (1e3 * 60 * 60 * 24)));
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
          extra: t.extra_branches || 0
        },
        counters: {
          active: countersCount,
          allowed: (t.base_counters || 1) + (t.extra_counters || 0),
          base: t.base_counters || 1,
          extra: t.extra_counters || 0
        },
        users: {
          active: usersCount,
          allowed: (t.base_users || 3) + (t.extra_users || 0),
          base: t.base_users || 3,
          extra: t.extra_users || 0
        }
      }
    });
  } catch (error) {
    console.error("Subscription Status Error:", error);
    return errorResponse(res, "Failed to fetch subscription status", 500, error);
  }
};
var createSubscriptionOrder = async (req, res) => {
  const dbName = req.user?.tenant_db;
  const { action, branches = 0, counters = 0, users = 0 } = req.body;
  if (!dbName || dbName === "kms_master") {
    return errorResponse(res, "Invalid tenant context", 400);
  }
  try {
    const [tenants] = await masterPool.execute(
      "SELECT * FROM tenants WHERE db_name = ?",
      [dbName]
    );
    if (!tenants || tenants.length === 0) {
      return errorResponse(res, "Tenant not found", 404);
    }
    const t = tenants[0];
    let usdAmount = 0;
    let details = "";
    if (action === "renew") {
      usdAmount = PRICE_BASE_YEARLY_USD;
      details = "Yearly Base Plan Subscription Renewal";
    } else if (action === "upgrade") {
      if (!t.plan_end_date) {
        return errorResponse(res, "No active plan found to upgrade. Please subscribe first.", 400);
      }
      const endMs = new Date(t.plan_end_date).getTime();
      const nowMs = Date.now();
      const remainingDays = Math.max(0, (endMs - nowMs) / (1e3 * 60 * 60 * 24));
      if (remainingDays <= 0) {
        return errorResponse(res, "Your plan has expired. Please renew first.", 400);
      }
      const proRataMultiplier = remainingDays / 365;
      const branchCost = branches * PRICE_BRANCH_YEARLY_USD * proRataMultiplier;
      const counterCost = counters * PRICE_COUNTER_YEARLY_USD * proRataMultiplier;
      const userCost = users * PRICE_USER_YEARLY_USD * proRataMultiplier;
      usdAmount = branchCost + counterCost + userCost;
      details = `Upgrade: Add ${branches} branch(es), ${counters} counter(s), ${users} user(s) [Pro-rated for ${Math.ceil(remainingDays)} days]`;
      if (usdAmount <= 0) {
        return errorResponse(res, "Invalid upgrade limits specified", 400);
      }
    } else {
      return errorResponse(res, "Invalid billing action", 400);
    }
    const amountInCents = Math.round(usdAmount * 100);
    const razorpayOrder = await razorpay_default.orders.create({
      amount: amountInCents,
      currency: "USD",
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
    await masterPool.execute(
      `INSERT INTO tenant_transactions (tenant_id, payment_type, amount, razorpay_order_id, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [t.tenant_id, action === "renew" ? "base_plan" : "add_branch", usdAmount, razorpayOrder.id]
    );
    return successResponse(res, {
      order_id: razorpayOrder.id,
      amount: usdAmount,
      currency: "USD",
      details
    });
  } catch (error) {
    console.error("Create Subscription Order Error:", error);
    return errorResponse(res, "Failed to initialize subscription checkout", 500, error);
  }
};
var verifySubscriptionPayment = async (req, res) => {
  const dbName = req.user?.tenant_db;
  const { order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (!order_id || !razorpay_payment_id || !razorpay_signature) {
    return errorResponse(res, "Missing signature verification parameters", 400);
  }
  try {
    const generatedSignature = crypto.createHmac("sha256", config.razorpay.keySecret).update(order_id + "|" + razorpay_payment_id).digest("hex");
    if (generatedSignature !== razorpay_signature) {
      return errorResponse(res, "Payment verification failed: Signature mismatch", 400);
    }
    const rzpOrder = await razorpay_default.orders.fetch(order_id);
    const notes = rzpOrder.notes;
    const tenantId = Number(notes.tenant_id);
    const action = notes.action;
    const addBranches = Number(notes.branches || 0);
    const addCounters = Number(notes.counters || 0);
    const addUsers = Number(notes.users || 0);
    await masterPool.execute(
      `UPDATE tenant_transactions 
       SET status = 'completed', razorpay_payment_id = ?, razorpay_signature = ?
       WHERE razorpay_order_id = ?`,
      [razorpay_payment_id, razorpay_signature, order_id]
    );
    if (action === "renew") {
      const startDate = /* @__PURE__ */ new Date();
      const endDate = /* @__PURE__ */ new Date();
      endDate.setFullYear(startDate.getFullYear() + 1);
      await masterPool.execute(
        `UPDATE tenants 
         SET plan_start_date = ?, plan_end_date = ?, status = 'Active',
             base_branches = 1, base_counters = 1, base_users = 3
         WHERE tenant_id = ?`,
        [startDate, endDate, tenantId]
      );
    } else if (action === "upgrade") {
      await masterPool.execute(
        `UPDATE tenants 
         SET extra_branches = extra_branches + ?, 
             extra_counters = extra_counters + ?, 
             extra_users = extra_users + ?
         WHERE tenant_id = ?`,
        [addBranches, addCounters, addUsers, tenantId]
      );
    }
    return successResponse(res, null, "Payment verified and subscription limits upgraded successfully");
  } catch (error) {
    console.error("Verify Subscription Signature Error:", error);
    return errorResponse(res, "Payment verification failed", 500, error);
  }
};
var getCounters = async (req, res) => {
  try {
    const [rows] = await db_default.execute(`
      SELECT pc.*, b.name_en as branch_name_en, b.name_ar as branch_name_ar
      FROM pos_counters pc
      LEFT JOIN branches b ON pc.branch_id = b.branch_id
      WHERE pc.deleted_at IS NULL
      ORDER BY pc.created_at DESC
    `);
    return successResponse(res, rows);
  } catch (error) {
    console.error("Get Counters Error:", error);
    return errorResponse(res, "Failed to retrieve POS counters", 500, error);
  }
};
var createCounter = async (req, res) => {
  const dbName = req.user?.tenant_db;
  const { branch_id, name } = req.body;
  if (!branch_id || !name) {
    return errorResponse(res, "Branch and counter name are required", 400);
  }
  try {
    const [tenants] = await masterPool.execute(
      "SELECT * FROM tenants WHERE db_name = ?",
      [dbName]
    );
    if (!tenants || tenants.length === 0) {
      return errorResponse(res, "Tenant context not found", 404);
    }
    const t = tenants[0];
    const allowedCounters = (t.base_counters || 1) + (t.extra_counters || 0);
    const [countersRes] = await db_default.execute("SELECT COUNT(*) as count FROM pos_counters WHERE deleted_at IS NULL");
    const activeCounters = countersRes[0].count;
    if (activeCounters >= allowedCounters) {
      return errorResponse(
        res,
        `Counter creation blocked. Your plan allows up to ${allowedCounters} POS counters. Please upgrade your subscription limit first.`,
        403
      );
    }
    const [result] = await db_default.execute(
      "INSERT INTO pos_counters (branch_id, name) VALUES (?, ?)",
      [branch_id, name]
    );
    return successResponse(res, { counter_id: result.insertId, branch_id, name }, "POS Counter created successfully");
  } catch (error) {
    console.error("Create Counter Error:", error);
    return errorResponse(res, "Failed to create POS counter", 500, error);
  }
};
var deleteCounter = async (req, res) => {
  const { id } = req.params;
  try {
    await db_default.execute(
      "UPDATE pos_counters SET deleted_at = NOW() WHERE counter_id = ?",
      [id]
    );
    return successResponse(res, null, "POS Counter deleted successfully");
  } catch (error) {
    console.error("Delete Counter Error:", error);
    return errorResponse(res, "Failed to delete POS counter", 500, error);
  }
};
var getActiveSession = async (req, res) => {
  const { branch_id } = req.query;
  if (!branch_id) {
    return errorResponse(res, "branch_id is required", 400);
  }
  try {
    const [rows] = await db_default.execute(`
      SELECT pcs.*, pc.name as counter_name
      FROM pos_counter_sessions pcs
      JOIN pos_counters pc ON pcs.counter_id = pc.counter_id
      WHERE pcs.branch_id = ? AND pcs.status = 'open'
      LIMIT 1
    `, [Number(branch_id)]);
    if (rows.length === 0) {
      return successResponse(res, null, "No open session for this branch");
    }
    return successResponse(res, rows[0], "Active counter session retrieved");
  } catch (error) {
    console.error("Get Active Session Error:", error);
    return errorResponse(res, "Failed to fetch active session", 500, error);
  }
};
var openSession = async (req, res) => {
  const { counter_id, branch_id, opening_balance } = req.body;
  const adminId = req.user?.admin_id;
  if (!counter_id || !branch_id) {
    return errorResponse(res, "counter_id and branch_id are required", 400);
  }
  try {
    const [existing] = await db_default.execute(
      "SELECT * FROM pos_counter_sessions WHERE branch_id = ? AND status = 'open' LIMIT 1",
      [branch_id]
    );
    if (existing.length > 0) {
      return errorResponse(res, "A counter session is already open for this branch. Please close it first.", 400);
    }
    const [result] = await db_default.execute(
      `INSERT INTO pos_counter_sessions (counter_id, branch_id, opened_by, opening_balance, status)
       VALUES (?, ?, ?, ?, 'open')`,
      [counter_id, branch_id, adminId, opening_balance || 0]
    );
    return successResponse(res, { session_id: result.insertId }, "POS Counter session opened successfully");
  } catch (error) {
    console.error("Open Session Error:", error);
    return errorResponse(res, "Failed to open counter session", 500, error);
  }
};
var getSessionSummary = async (req, res) => {
  const { id } = req.params;
  try {
    const [sessionRows] = await db_default.execute(
      `SELECT pcs.*, pc.name as counter_name
       FROM pos_counter_sessions pcs
       JOIN pos_counters pc ON pcs.counter_id = pc.counter_id
       WHERE pcs.session_id = ?`,
      [id]
    );
    if (sessionRows.length === 0) {
      return errorResponse(res, "Session not found", 404);
    }
    const session = sessionRows[0];
    const openedAt = session.opened_at;
    const closedAt = session.closed_at || /* @__PURE__ */ new Date();
    const [salesRows] = await db_default.execute(
      `SELECT 
        COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_sales,
        COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_sales,
        COALESCE(SUM(total_amount), 0) as total_sales
       FROM sales_orders
       WHERE branch_id = ? AND counter_id = ? AND created_at >= ? AND created_at <= ? AND deleted_at IS NULL`,
      [session.branch_id, session.counter_id, openedAt, closedAt]
    );
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
  } catch (error) {
    console.error("Get Session Summary Error:", error);
    return errorResponse(res, "Failed to retrieve session summary", 500, error);
  }
};
var closeSession = async (req, res) => {
  const { session_id, closing_balance } = req.body;
  const adminId = req.user?.admin_id;
  if (!session_id) {
    return errorResponse(res, "session_id is required", 400);
  }
  try {
    await db_default.execute(
      `UPDATE pos_counter_sessions 
       SET status = 'closed', closed_by = ?, closed_at = NOW(), closing_balance = ?
       WHERE session_id = ?`,
      [adminId, closing_balance || 0, session_id]
    );
    return successResponse(res, null, "Counter session closed successfully");
  } catch (error) {
    console.error("Close Session Error:", error);
    return errorResponse(res, "Failed to close counter session", 500, error);
  }
};

// src/routes/subscription.routes.ts
var router24 = Router21();
router24.use(authMiddleware);
router24.get("/status", getSubscriptionStatus);
router24.post("/create-order", createSubscriptionOrder);
router24.post("/verify-payment", verifySubscriptionPayment);
router24.get("/counters", getCounters);
router24.post("/counters", createCounter);
router24.delete("/counters/:id", deleteCounter);
router24.get("/counters/active-session", getActiveSession);
router24.post("/counters/sessions/open", openSession);
router24.get("/counters/sessions/:id/summary", getSessionSummary);
router24.post("/counters/sessions/close", closeSession);
var subscription_routes_default = router24;

// src/routes/tenant.routes.ts
import { Router as Router22 } from "express";

// src/controllers/tenant.controller.ts
init_db();

// src/config/initTenant.ts
init_config();
import mysql2 from "mysql2/promise";
import fs3 from "fs";
import path4 from "path";
import bcrypt2 from "bcryptjs";
var provisionTenantDatabase = async (dbName, adminDetails) => {
  const connection = await mysql2.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.pass
  });
  try {
    await connection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`\u2705 Tenant database '${dbName}' created successfully.`);
    await connection.changeUser({ database: dbName });
    const schemaPath = path4.join(process.cwd(), "schema.sql");
    let schemaSql = fs3.readFileSync(schemaPath, "utf8");
    schemaSql = schemaSql.replace(/CREATE DATABASE IF NOT EXISTS kms_master;/g, "");
    schemaSql = schemaSql.replace(/USE kms_master;/g, "");
    const pool = await mysql2.createPool({
      host: config.db.host,
      user: config.db.user,
      password: config.db.pass,
      database: dbName,
      multipleStatements: true
    });
    console.log(`\u23F3 Importing schema.sql into '${dbName}'...`);
    await pool.query(schemaSql);
    console.log(`\u2705 Schema imported successfully into '${dbName}'.`);
    console.log(`\u23F3 Seeding default admin for '${dbName}'...`);
    const hash = await bcrypt2.hash(adminDetails.password || "admin123", 10);
    await pool.execute(
      "INSERT INTO admins (username, email, password, role_id, first_name, status) VALUES (?, ?, ?, ?, ?, ?)",
      [adminDetails.username || "admin", adminDetails.email, hash, 1, adminDetails.name || "Admin", "active"]
    );
    console.log(`\u2705 Admin seeded successfully for '${dbName}'.`);
    if (adminDetails.name) {
      await pool.execute(
        "INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        ["company_name", adminDetails.name]
      );
      console.log(`\u2705 Default settings seeded for '${dbName}'.`);
    }
    await pool.end();
  } catch (error) {
    console.error(`\u274C Failed to provision tenant database '${dbName}':`, error);
    throw error;
  } finally {
    await connection.end();
  }
};

// src/controllers/tenant.controller.ts
import { v4 as uuidv4 } from "uuid";
var createTenant = async (req, res) => {
  const { name, email, phone, plan, password } = req.body;
  if (!name || !email) {
    return errorResponse(res, "Name and email are required", 400);
  }
  const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  const randomHash = uuidv4().replace(/-/g, "").substring(0, 4);
  const dbName = `kms_${sanitizedName}_${randomHash}`;
  try {
    await provisionTenantDatabase(dbName, {
      name,
      email,
      username: email.split("@")[0],
      password: password || "admin123"
      // Use custom password or fallback
    });
    const [result] = await db_default.execute(
      `INSERT INTO tenants (name, contact_email, contact_phone, plan, db_name, status, plan_start_date, plan_end_date) 
             VALUES (?, ?, ?, ?, ?, 'Active', NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR))`,
      [name, email, phone || null, plan || "Basic", dbName]
    );
    return successResponse(res, {
      tenant_id: result.insertId,
      name,
      email,
      db_name: dbName
    }, "Tenant created and provisioned successfully");
  } catch (error) {
    console.error("Tenant Creation Error:", error);
    return errorResponse(res, "Failed to create tenant: " + (error.message || String(error)), 500);
  }
};
var updateTenant = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, plan, status } = req.body;
  try {
    await db_default.execute(
      "UPDATE tenants SET name = ?, contact_email = ?, contact_phone = ?, plan = ?, status = ? WHERE tenant_id = ?",
      [name, email, phone || null, plan, status, id]
    );
    return successResponse(res, null, "Tenant updated successfully");
  } catch (error) {
    console.error("Tenant Update Error:", error);
    return errorResponse(res, "Failed to update tenant: " + (error.message || String(error)), 500);
  }
};
var getTenants = async (req, res) => {
  try {
    const [rows] = await db_default.execute("SELECT * FROM tenants ORDER BY created_at DESC");
    const enrichedTenants = rows.map((t) => ({
      id: t.tenant_id,
      name: t.name,
      email: t.contact_email,
      phone: t.contact_phone,
      plan: t.plan,
      status: t.status,
      db_name: t.db_name,
      branches: t.plan === "Enterprise" ? 10 : t.plan === "Pro" ? 3 : 1,
      mrr: t.plan === "Enterprise" ? 499 : t.plan === "Pro" ? 149 : 49
    }));
    return successResponse(res, enrichedTenants, "Tenants retrieved successfully");
  } catch (error) {
    console.error("Get Tenants Error:", error);
    return errorResponse(res, "Failed to retrieve tenants", 500);
  }
};

// src/routes/tenant.routes.ts
var router25 = Router22();
router25.use(authMiddleware);
router25.get("/", getTenants);
router25.post("/", createTenant);
router25.put("/:id", updateTenant);
var tenant_routes_default = router25;

// src/routes/index.ts
var router26 = Router23();
router26.use("/subscription", subscription_routes_default);
router26.use("/tenants", tenant_routes_default);
router26.use("/auth", auth_routes_default);
router26.use("/business", business_routes_default);
router26.use("/inventory", inventory_routes_default);
router26.use("/wastage", wastage_routes_default);
router26.use("/vendors", vendor_routes_default);
router26.use("/purchases", purchase_routes_default);
router26.use("/menu", menu_routes_default);
router26.use("/branches", branch_routes_default);
router26.use("/sales", sales_routes_default);
router26.use("/accounts", accounts_routes_default);
router26.use("/factory", factory_routes_default);
router26.use("/settings", settings_routes_default);
router26.use("/analytics", analytics_routes_default);
router26.use("/notifications", notification_routes_default);
router26.use("/reports", reports_routes_default);
router26.use("/salesmen", salesman_routes_default);
router26.use("/assets", assetsRoutes_default);
router26.use("/liabilities", liabilitiesRoutes_default);
router26.use("/employees", employeesRoutes_default);
router26.use("/expenses", expense_routes_default);
router26.use("/ai", ai_routes_default);
router26.use("/transfers", transfer_routes_default);
router26.use("/brands", brand_routes_default);
var routes_default = router26;

// src/middleware/error.middleware.ts
var errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  return errorResponse(res, message, status, err);
};

// src/app.ts
init_db();
var app = express4();
var initTenantEngine = async () => {
  try {
    await db_default.execute(`
            CREATE TABLE IF NOT EXISTS tenants (
                tenant_id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                contact_email VARCHAR(255) DEFAULT NULL,
                contact_phone VARCHAR(50) DEFAULT NULL,
                plan ENUM('Basic', 'Pro', 'Enterprise') DEFAULT 'Basic',
                status ENUM('Active', 'Inactive') DEFAULT 'Active',
                db_name VARCHAR(100) NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    console.log("\u{1F3E2} SaaS Tenant Engine: INITIALIZED & READY. \u{1F680}");
  } catch (err) {
    console.error("\u26D4 Tenant Initialization Barrier:", err);
  }
};
initTenantEngine();
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));
var allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5177",
  "http://localhost:5176",
  // Front-end dev port from package.json script
  config.corsOrigin,
  // Auto-read from .env.production
  "https://kms.ansoftt.com",
  "https://api.kms.ansoftt.com",
  "https://admin.kms.ansoftt.com"
];
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));
app.use("/uploads", express4.static(path5.join(process.cwd(), "uploads")));
app.use("/api/uploads", express4.static(path5.join(process.cwd(), "uploads")));
app.use(morgan(config.env === "development" ? "dev" : "combined"));
app.use(express4.json());
app.use(express4.urlencoded({ extended: true }));
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", env: config.env });
});
app.get("/api/debug-db", async (req, res) => {
  const [rows] = await db_default.query("SELECT DATABASE() as db");
  res.json(rows[0]);
});
app.use("/api", routes_default);
app.use((req, res) => {
  return errorResponse(res, "Route not found", 404);
});
app.use(errorHandler);
var app_default = app;

// src/server.ts
var PORT = process.env.PORT || 5e3;
app_default.listen(PORT, () => {
  console.log(`\u{1F680} Server running on http://localhost:${PORT}`);
});
