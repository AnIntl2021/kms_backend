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
      corsOrigin: process.env.CORS_ORIGIN || "*"
    };
  }
});

// src/config/db.ts
import mysql from "mysql2/promise";
var dbConfig, pool, db_default;
var init_db = __esm({
  "src/config/db.ts"() {
    "use strict";
    init_config();
    dbConfig = {
      host: config.db.host,
      user: config.db.user,
      password: config.db.pass,
      database: config.db.name,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    };
    pool = mysql.createPool(dbConfig);
    db_default = pool;
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
import express from "express";
import cors from "cors";
import path4 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
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
import { Router as Router17 } from "express";

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
var login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return errorResponse(res, "Username and password are required", 400);
    }
    console.log("Attempting login for:", username);
    const [rows] = await db_default.execute(
      `SELECT a.*, r.role_name, r.display_name_en, r.display_name_ar 
       FROM admins a 
       JOIN roles r ON a.role_id = r.role_id 
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
    console.log("Found user:", admin.username);
    console.log("Found ID:", admin.admin_id);
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      console.log("\u274C LOGIN FAILED: Password mismatch");
      return errorResponse(res, "Invalid credentials", 401);
    }
    console.log("\u2705 PASSWORDS MATCH! Generating token for admin:", admin.admin_id);
    const token = generateToken({
      admin_id: admin.admin_id,
      username: admin.username,
      role: admin.role_name,
      display_name: admin.display_name_en
    });
    console.log("Logging audit entry for:", admin.admin_id);
    await db_default.execute(
      "INSERT INTO audit_logs (admin_id, action, entity_name, ip_address) VALUES (?, ?, ?, ?)",
      [admin.admin_id, "LOGIN", "auth", req.ip]
    );
    console.log("Audit log entry created");
    return successResponse(res, {
      admin: {
        admin_id: admin.admin_id,
        username: admin.username,
        role: admin.role_name,
        firstName: admin.first_name,
        lastName: admin.last_name
      },
      token
    }, "Login successful");
  } catch (error) {
    console.error("Login Error:", error);
    return errorResponse(res, "Login failed during processing", 500, error);
  }
};
var getRoles = async (req, res) => {
  try {
    const [roles] = await db_default.execute("SELECT role_id, role_name, display_name_en, display_name_ar FROM roles WHERE deleted_at IS NULL");
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
    const [users] = await db_default.execute(`
      SELECT a.admin_id, a.username, a.email, a.first_name, a.last_name, a.status, a.created_at, r.role_name 
      FROM admins a 
      JOIN roles r ON a.role_id = r.role_id 
      WHERE a.deleted_at IS NULL
    `);
    return successResponse(res, users);
  } catch (error) {
    return errorResponse(res, "Failed to fetch users", 500, error);
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
    const { username, email, password, role_id, first_name, last_name, status } = req.body;
    const [existing] = await db_default.execute("SELECT admin_id FROM admins WHERE username = ? OR email = ?", [username, email]);
    if (existing.length > 0) return errorResponse(res, "Username or Email already exists", 400);
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await db_default.execute(
      "INSERT INTO admins (username, email, password, role_id, first_name, last_name, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [username, email, hashedPassword, role_id, first_name, last_name, status || "active"]
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

// src/middleware/auth.middleware.ts
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
  next();
};
var authorize = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return errorResponse(res, "Access denied: insufficient permissions", 403);
    }
    next();
  };
};

// src/routes/auth.routes.ts
var router = Router();
router.post("/login", login);
router.get("/profile", authMiddleware, getProfile);
router.get("/roles", authMiddleware, getRoles);
router.get("/users", authMiddleware, authorize(["super_admin", "manager"]), getUsers);
router.post("/users", authMiddleware, authorize(["super_admin", "manager"]), createUser);
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
    const fileName = `fresh_n_fast_backup_${timestamp}.sql`;
    const filePath = path2.join(BACKUP_DIR, fileName);
    const host = config.db.host || "localhost";
    const user = config.db.user || "root";
    const password = config.db.pass || "";
    const dbName = config.db.name || "fresh_n_fast_db";
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
var getSettings = async (req, res) => {
  try {
    const [settings] = await db_default.execute("SELECT * FROM system_settings");
    const settingsObj = settings.reduce((acc, curr) => {
      acc[curr.setting_key] = curr.setting_value;
      return acc;
    }, {});
    return successResponse(res, settingsObj);
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
    const { name_en, name_ar, sku, category_id, current_stock, min_stock_level, unit_en, unit_ar, cost_price, sort_order, packages } = req.body;
    const [result] = await connection.execute(
      `INSERT INTO inventory_items (name_en, name_ar, sku, category_id, current_stock, min_stock_level, unit_en, unit_ar, cost_price, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name_en, name_ar, sku, category_id, current_stock || 0, min_stock_level || 5, unit_en || "kg", unit_ar || "\u0643\u062C\u0645", cost_price || 0, sort_order || 0]
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
    const [items] = await db_default.execute(`
      SELECT mi.*, c.name_en as category_name 
      FROM menu_items mi
      LEFT JOIN categories c ON mi.category_id = c.category_id
      WHERE mi.deleted_at IS NULL
      ORDER BY mi.sort_order ASC, mi.name_en ASC
    `);
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
    return successResponse(res, { ...items[0], ingredients });
  } catch (error) {
    console.error("getMenuItemDetails Error:", error);
    return errorResponse(res, "Failed to fetch menu details", 500, error);
  }
};
var createMenuItem = async (req, res) => {
  const connection = await db_default.getConnection();
  try {
    await connection.beginTransaction();
    const { name_en, name_ar, category_id, price, cost_price, description_en, description_ar, type, barcode, unit_en, unit_ar } = req.body;
    let { ingredients } = req.body;
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
      "INSERT INTO menu_items (category_id, name_en, name_ar, barcode, price, unit_en, unit_ar, cost_price, type, description_en, description_ar, image_url, yield_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        yield_quantity
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
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path3.dirname(__filename);
var createDir = (dirPath) => {
  if (!fs2.existsSync(dirPath)) {
    fs2.mkdirSync(dirPath, { recursive: true });
  }
};
var storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path3.join(__dirname, "../../uploads/menu");
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
router6.post("/", authorize(["super_admin", "manager"]), upload.single("image"), createMenuItem);
router6.put("/:id", authorize(["super_admin", "manager"]), upload.single("image"), updateMenuItem);
router6.delete("/:id", authorize(["super_admin"]), deleteMenuItem);
var menu_routes_default = router6;

// src/routes/branch.routes.ts
import { Router as Router7 } from "express";

// src/controllers/branch.controller.ts
init_db();
var getBranches = async (req, res) => {
  try {
    const [branches] = await db_default.execute("SELECT * FROM branches WHERE deleted_at IS NULL ORDER BY name_en");
    return successResponse(res, branches);
  } catch (error) {
    return errorResponse(res, "Failed to fetch branches", 500, error);
  }
};
var createBranch = async (req, res) => {
  try {
    const { name_en, name_ar, location_en, location_ar, phone } = req.body;
    const [result] = await db_default.execute(
      "INSERT INTO branches (name_en, name_ar, location_en, location_ar, phone) VALUES (?, ?, ?, ?, ?)",
      [name_en, name_ar, location_en || null, location_ar || null, phone || null]
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
    await db_default.execute(`
      UPDATE sales_orders 
      SET payment_status = 'paid' 
      WHERE payment_status = 'credit' 
      AND expiry_date <= CURRENT_DATE()
      AND deleted_at IS NULL
    `);
    const [rows] = await db_default.execute(`
      SELECT s.*, 
      (SELECT COUNT(*) FROM sales_order_items WHERE sale_id = s.sale_id) as items_count,
      IFNULL((SELECT SUM(total_credit_amount) FROM sales_returns WHERE sale_id = s.sale_id), 0) as returns_amount,
      DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
      pb.name_en as branch_name,
      pb.phone as branch_phone,
      v.phone as client_phone,
      sm.name_en as salesman_name,
      sm.phone as salesman_phone
      FROM sales_orders s 
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN salesmen sm ON s.salesman_id = sm.salesman_id
      WHERE s.deleted_at IS NULL
      ORDER BY s.created_at DESC, s.sale_id DESC
    `);
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
             pb.name_en as branch_name,
             pb.phone as branch_phone,
             v.phone as client_phone,
             sm.name_en as salesman_name,
             sm.phone as salesman_phone
      FROM sales_orders s 
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN salesmen sm ON s.salesman_id = sm.salesman_id
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
    const { vendor_id, branch_id, customer_name, items, total_amount, payment_status, dispatch_status, batch_number, expiry_date, dispatch_date } = req.body;
    const admin_id = req.user?.admin_id || 1;
    await connection.beginTransaction();
    const [orderRes] = await connection.execute(
      "INSERT INTO sales_orders (order_number, vendor_id, branch_id, customer_name, total_amount, payment_status, dispatch_status, batch_number, expiry_date, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ["PENDING", vendor_id || null, (branch_id === "main" ? null : branch_id) || null, customer_name, total_amount, payment_status || "credit", dispatch_status || "pending", batch_number || null, expiry_date || null, admin_id, dispatch_date || /* @__PURE__ */ new Date()]
    );
    const sale_id = orderRes.insertId;
    const order_number = `FNFI-${1e5 + sale_id}`;
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
    return successResponse(res, { sale_id }, "Sale recorded successfully");
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
    const [dispatches] = await db_default.execute(`
      SELECT 
        s.sale_id, s.order_number, s.vendor_id, s.branch_id, s.customer_name, s.total_amount, 
        s.discount_amount, s.final_amount, s.dispatch_status, s.batch_number, s.expiry_date, 
        DATE_FORMAT(s.created_at, '%Y-%m-%d') as dispatch_date,
        s.created_at,
        v.name_en as client_name,
        pb.name_en as branch_name,
        sm.name_en as salesman_name,
        sm.phone as salesman_phone
      FROM sales_orders s
      LEFT JOIN vendors v ON s.vendor_id = v.vendor_id
      LEFT JOIN partner_branches pb ON s.branch_id = pb.branch_id
      LEFT JOIN salesmen sm ON s.salesman_id = sm.salesman_id
      WHERE s.vendor_id IS NOT NULL AND s.deleted_at IS NULL
      ORDER BY s.created_at DESC, s.sale_id DESC
    `);
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
      discountFactor = 0.75;
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
        discountFactor = 0.75;
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
        ri.menu_item_id, ri.quantity, ri.unit_price as price,
        m.name_en, m.name_ar, m.barcode as item_code
      FROM sales_return_items ri
      LEFT JOIN menu_items m ON ri.menu_item_id = m.menu_item_id
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
      "UPDATE sales_orders SET dispatch_status = ? WHERE sale_id = ?",
      [status, id]
    );
    if (result.affectedRows === 0) {
      const [retry] = await db_default.execute(
        "UPDATE sales_orders SET dispatch_status = ? WHERE sales_order_id = ?",
        [status, id]
      );
      if (retry.affectedRows === 0) {
        return errorResponse(res, `No order found with ID ${id}`, 404);
      }
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
var getStoreForecasting = async (req, res) => {
  try {
    const [stats] = await db_default.execute(`
      SELECT 
        v.vendor_id, 
        v.name_en as vendor_name, 
        SUM(CASE WHEN so.dispatch_status IN ('delivered', 'dispatched', 'in_transit', 'paid') THEN so.final_amount ELSE 0 END) as sales_performance,
        (
          SELECT SUM(w.quantity) 
          FROM wastage w 
          LEFT JOIN sales_returns r ON w.return_id = r.return_id
          WHERE (w.vendor_id = v.vendor_id OR r.vendor_id = v.vendor_id)
          AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_wastage_units,
        (
          SELECT SUM(w.quantity * COALESCE(mi.cost_price, 0)) 
          FROM wastage w 
          JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id
          LEFT JOIN sales_returns r ON w.return_id = r.return_id
          WHERE (w.vendor_id = v.vendor_id OR r.vendor_id = v.vendor_id)
          AND w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_loss_kwd,
        (
          SELECT SUM(so_inner.final_amount) 
          FROM sales_orders so_inner 
          WHERE so_inner.vendor_id = v.vendor_id 
          AND so_inner.dispatch_status IN ('delivered', 'dispatched', 'in_transit')
          AND so_inner.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_sales,
        (
          SELECT SUM(soi.quantity)
          FROM sales_order_items soi
          JOIN sales_orders s ON soi.sale_id = s.sale_id
          WHERE s.vendor_id = v.vendor_id
          AND s.dispatch_status IN ('delivered', 'dispatched', 'in_transit')
          AND s.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as recent_sold_units
      FROM vendors v
      LEFT JOIN sales_orders so ON v.vendor_id = so.vendor_id
      WHERE v.deleted_at IS NULL
      GROUP BY v.vendor_id
    `);
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
  } catch (error) {
    console.error("Forecasting Error:", error);
    return errorResponse(res, "Failed to generate financial analytics", 500, error);
  }
};
var getProductionHealth = async (req, res) => {
  try {
    const [hp] = await db_default.execute(`
      SELECT 
        (SELECT SUM(quantity_produced) FROM production_items) as total_produced,
        (SELECT SUM(quantity) FROM wastage WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as total_wasted,
        
        -- \u{1FA7A} LOSS BY COST: Actual manufacturing cost lost to wastage
        (SELECT SUM(w.quantity * COALESCE(mi.cost_price, 0)) 
         FROM wastage w 
         JOIN menu_items mi ON w.menu_item_id = mi.menu_item_id 
         WHERE w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as total_loss_kwd,
         
        (SELECT SUM(final_amount) FROM sales_orders WHERE dispatch_status IN ('delivered', 'dispatched', 'in_transit', 'paid') AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND deleted_at IS NULL) as total_revenue_7d,
        
        -- \u{1FA7A} LOSS BY COST: Actual manufacturing cost lost to returns
        (SELECT IFNULL(SUM(ri.quantity * COALESCE(mi.cost_price, 0)), 0) 
         FROM sales_return_items ri 
         JOIN menu_items mi ON ri.menu_item_id = mi.menu_item_id
         JOIN sales_returns r ON ri.return_id = r.return_id
         WHERE r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND r.deleted_at IS NULL) as total_returns_7d,
         
        (
          SELECT IFNULL(SUM(soi.quantity * COALESCE(mi.cost_price, 0)), 0)
          FROM sales_order_items soi
          JOIN sales_orders so ON soi.sale_id = so.sale_id
          LEFT JOIN menu_items mi ON soi.menu_item_id = mi.menu_item_id
          WHERE so.dispatch_status IN ('delivered', 'dispatched', 'in_transit', 'paid') 
          AND so.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND so.deleted_at IS NULL
        ) as total_production_cost_7d
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
var getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, vendor_id, branch_id, salesman_id } = req.query;
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
    const { startDate, endDate, vendor_id, branch_id, salesman_id } = req.query;
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
    const [rows] = await db_default.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error("Wastage Report Error:", error);
    return errorResponse(res, "Failed to fetch wastage report", 500, error);
  }
};
var getAnalyticsSummary = async (req, res) => {
  try {
    const { startDate, endDate, vendor_id, branch_id, salesman_id } = req.query;
    const params = [];
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
    const [dailyTrend] = await db_default.execute(dailyQuery, params);
    const [topCustomers] = await db_default.execute(customersQuery, params);
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
    const [rows] = await db_default.execute(query, params);
    return successResponse(res, rows);
  } catch (error) {
    console.error("Purchase Report Error:", error);
    return errorResponse(res, "Failed to fetch purchase report", 500, error);
  }
};
var getProductPerformanceReport = async (req, res) => {
  try {
    const { startDate, endDate, vendor_id, branch_id, salesman_id } = req.query;
    const subDateFilter = startDate && endDate ? "AND DATE(sr.created_at) BETWEEN ? AND ?" : "";
    const subVendorFilter = vendor_id ? "AND sr.vendor_id = ?" : "";
    const subBranchFilter = branch_id ? "AND sr.branch_id = ?" : "";
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
    if (startDate && endDate) params.push(startDate, endDate);
    if (vendor_id) params.push(vendor_id);
    if (branch_id) params.push(branch_id);
    if (salesman_id) params.push(salesman_id);
    if (startDate && endDate) params.push(startDate, endDate);
    if (vendor_id) params.push(vendor_id);
    if (branch_id) params.push(branch_id);
    if (salesman_id) params.push(salesman_id);
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
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const start = startDate ? String(startDate) : new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1).toISOString().split("T")[0];
    const end = endDate ? String(endDate) : today;
    const [items] = await db_default.execute(`
      SELECT ii.inventory_item_id, ii.name_en, ii.name_ar, ii.sku, ii.current_stock, ii.min_stock_level, ii.unit_en, ii.unit_ar, ii.cost_price,
      c.name_en as category_name
      FROM inventory_items ii
      LEFT JOIN categories c ON ii.category_id = c.category_id
      WHERE ii.deleted_at IS NULL
      ORDER BY c.name_en ASC, ii.name_en ASC
    `);
    const [receivingRows] = await db_default.execute(`
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) BETWEEN ? AND ?
      GROUP BY poi.inventory_item_id
    `, [start, end]);
    const receivingMap = new Map(receivingRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    const [wastageRows] = await db_default.execute(`
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) BETWEEN ? AND ?
      GROUP BY w.inventory_item_id
    `, [start, end]);
    const wastageMap = new Map(wastageRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    const [productionRows] = await db_default.execute(`
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
    const [recSinceStartRows] = await db_default.execute(`
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) >= ?
      GROUP BY poi.inventory_item_id
    `, [start]);
    const recSinceStartMap = new Map(recSinceStartRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    const [wasteSinceStartRows] = await db_default.execute(`
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) >= ?
      GROUP BY w.inventory_item_id
    `, [start]);
    const wasteSinceStartMap = new Map(wasteSinceStartRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    const [prodSinceStartRows] = await db_default.execute(`
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
    const [recAfterEndRows] = await db_default.execute(`
      SELECT poi.inventory_item_id, SUM(poi.quantity) as total_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_id = po.purchase_id
      WHERE po.status = 'received'
        AND DATE(po.received_at) > ?
      GROUP BY poi.inventory_item_id
    `, [end]);
    const recAfterEndMap = new Map(recAfterEndRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    const [wasteAfterEndRows] = await db_default.execute(`
      SELECT w.inventory_item_id, SUM(w.quantity) as total_qty
      FROM wastage w
      WHERE w.deleted_at IS NULL
        AND DATE(w.created_at) > ?
      GROUP BY w.inventory_item_id
    `, [end]);
    const wasteAfterEndMap = new Map(wasteAfterEndRows.map((r) => [r.inventory_item_id, parseFloat(r.total_qty || 0)]));
    const [prodAfterEndRows] = await db_default.execute(`
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
    const [salesRows] = await db_default.execute(`
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
  } catch (error) {
    console.error("Food Cost Report Error:", error);
    return errorResponse(res, "Failed to fetch food cost report", 500, error);
  }
};
var getClientStatements = async (req, res) => {
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
      if (branch_id === "main") {
        query += ` AND (s.branch_id IS NULL OR s.branch_id = 'main' OR s.branch_id = 0)`;
      } else {
        query += ` AND s.branch_id = ?`;
        params.push(branch_id);
      }
    }
    query += ` ORDER BY s.created_at DESC, s.sale_id DESC`;
    const [orders] = await db_default.execute(query, params);
    if (orders.length === 0) {
      return successResponse(res, []);
    }
    const orderIds = orders.map((o) => o.sale_id);
    const placeholders = orderIds.map(() => "?").join(",");
    const [items] = await db_default.execute(`
      SELECT soi.*, mi.name_en, mi.name_ar
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
router16.get("/", getSalesmen);
router16.get("/performance", getSalesmanPerformance);
router16.get("/:id", getSalesmanById);
router16.post("/", createSalesman);
router16.put("/:id", updateSalesman);
router16.delete("/:id", deleteSalesman);
var salesman_routes_default = router16;

// src/routes/index.ts
var router17 = Router17();
router17.use("/auth", auth_routes_default);
router17.use("/business", business_routes_default);
router17.use("/inventory", inventory_routes_default);
router17.use("/wastage", wastage_routes_default);
router17.use("/vendors", vendor_routes_default);
router17.use("/purchases", purchase_routes_default);
router17.use("/menu", menu_routes_default);
router17.use("/branches", branch_routes_default);
router17.use("/sales", sales_routes_default);
router17.use("/accounts", accounts_routes_default);
router17.use("/factory", factory_routes_default);
router17.use("/settings", settings_routes_default);
router17.use("/analytics", analytics_routes_default);
router17.use("/notifications", notification_routes_default);
router17.use("/reports", reports_routes_default);
router17.use("/salesmen", salesman_routes_default);
var routes_default = router17;

// src/middleware/error.middleware.ts
var errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err);
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";
  return errorResponse(res, message, status, err);
};

// src/app.ts
init_db();
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path4.dirname(__filename2);
var app = express();
var initFIFOEngine = async () => {
  try {
    await db_default.execute(`
            CREATE TABLE IF NOT EXISTS inventory_batches (
                batch_id INT AUTO_INCREMENT PRIMARY KEY,
                inventory_item_id INT NOT NULL,
                purchase_id INT DEFAULT NULL,
                original_quantity DECIMAL(15, 3) NOT NULL,
                remaining_quantity DECIMAL(15, 3) NOT NULL,
                cost_per_unit DECIMAL(15, 3) NOT NULL,
                status ENUM('active', 'exhausted') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(inventory_item_id) ON DELETE CASCADE,
                INDEX idx_fifo_lookup (inventory_item_id, status, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    console.log("\u{1F3D9}\uFE0F FIFO Batch Oracle Profile: INITIALIZED & READY. \u{1F6E1}\uFE0F\u{1F680}");
  } catch (err) {
    console.error("\u26D4 FIFO Initialization Barrier:", err);
  }
};
var initDistributionEngine = async () => {
  try {
    await db_default.execute(`
            CREATE TABLE IF NOT EXISTS partner_branches (
                branch_id INT AUTO_INCREMENT PRIMARY KEY,
                partner_id INT NOT NULL,
                name_en VARCHAR(255) NOT NULL,
                name_ar VARCHAR(255) DEFAULT NULL,
                address TEXT DEFAULT NULL,
                contact_person VARCHAR(255) DEFAULT NULL,
                phone VARCHAR(50) DEFAULT NULL,
                status ENUM('active', 'inactive') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (partner_id) REFERENCES vendors(vendor_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    try {
      await db_default.execute(`ALTER TABLE sales_orders ADD COLUMN branch_id INT DEFAULT NULL`);
    } catch (err) {
      if (err.errno !== 1060) console.error("Sales Order Column Sync:", err.message);
    }
    try {
      await db_default.execute(`ALTER TABLE sales_orders ADD CONSTRAINT fk_sales_order_branch FOREIGN KEY (branch_id) REFERENCES partner_branches(branch_id) ON DELETE SET NULL`);
    } catch (err) {
      if (err.errno !== 1061) console.error("Sales Order Constraint Sync:", err.message);
    }
    try {
      await db_default.execute(`ALTER TABLE purchase_orders ADD COLUMN branch_id INT DEFAULT NULL`);
    } catch (err) {
      if (err.errno !== 1060) console.error("Purchase Order Column Sync:", err.message);
    }
    try {
      await db_default.execute(`ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchase_order_branch FOREIGN KEY (branch_id) REFERENCES partner_branches(branch_id) ON DELETE SET NULL`);
    } catch (err) {
      if (err.errno !== 1061) console.error("Purchase Order Constraint Sync:", err.message);
    }
    const tablesToSync = ["production_logs", "sales_orders", "sales_returns"];
    for (const table of tablesToSync) {
      try {
        await db_default.execute(`ALTER TABLE ${table} ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`);
      } catch (err) {
        if (err.errno !== 1060) console.error(`Soft Delete Sync (${table}):`, err.message);
      }
    }
    try {
      await db_default.execute(`ALTER TABLE wastage ADD COLUMN menu_item_id INT DEFAULT NULL AFTER product_id`);
    } catch (err) {
      if (err.errno !== 1060) console.error("Wastage Column Sync (menu_item):", err.message);
    }
    try {
      await db_default.execute(`ALTER TABLE wastage ADD COLUMN vendor_id INT DEFAULT NULL AFTER menu_item_id`);
    } catch (err) {
      if (err.errno !== 1060) console.error("Wastage Column Sync (vendor_id):", err.message);
    }
    try {
      await db_default.execute(`ALTER TABLE wastage ADD CONSTRAINT fk_wastage_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id) ON DELETE SET NULL`);
    } catch (err) {
      if (err.errno !== 1061) console.error("Wastage Constraint Sync (menu_item):", err.message);
    }
    try {
      await db_default.execute(`ALTER TABLE wastage ADD CONSTRAINT fk_wastage_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE SET NULL`);
    } catch (err) {
      if (err.errno !== 1061) console.error("Wastage Constraint Sync (vendor_id):", err.message);
    }
    try {
      await db_default.execute(`
                CREATE TABLE IF NOT EXISTS salesmen (
                    salesman_id INT AUTO_INCREMENT PRIMARY KEY,
                    name_en VARCHAR(255) NOT NULL,
                    name_ar VARCHAR(255),
                    phone VARCHAR(20),
                    email VARCHAR(100),
                    commission_rate DECIMAL(5,2) DEFAULT 0.00,
                    status ENUM('active', 'inactive') DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP NULL
                ) ENGINE=InnoDB
            `);
    } catch (err) {
      console.error("Salesman Table Sync:", err.message);
    }
    try {
      await db_default.execute(`ALTER TABLE sales_orders ADD COLUMN salesman_id INT NULL AFTER admin_id`);
    } catch (err) {
      if (err.errno !== 1060) console.error("Sales Order Salesman Sync:", err.message);
    }
    try {
      await db_default.execute(`ALTER TABLE sales_orders ADD CONSTRAINT fk_sales_salesman FOREIGN KEY (salesman_id) REFERENCES salesmen(salesman_id) ON DELETE SET NULL`);
    } catch (err) {
      if (err.errno !== 1061) console.error("Sales Order Salesman Constraint:", err.message);
    }
    console.log("\u{1F69A} Distribution Branch Hub: INITIALIZED & READY. \u{1F6E1}\uFE0F\u{1F680}");
  } catch (err) {
    console.error("\u26D4 Distribution Initialization Barrier:", err);
  }
};
initFIFOEngine();
initDistributionEngine();
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));
var allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5177",
  config.corsOrigin,
  // Auto-read from .env.production (https://freshnfastkw.com)
  "https://freshnfastkw.com",
  "https://www.freshnfastkw.com",
  "https://api.freshnfastkw.com"
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith("http://localhost:")) {
      callback(null, true);
    } else {
      callback(new Error("Policy violation: CORS origin mismatch. Access denied. \u{1F6E1}\uFE0F"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));
app.use("/uploads", express.static(path4.join(process.cwd(), "uploads")));
app.use(morgan(config.env === "development" ? "dev" : "combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", env: config.env });
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
