"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const config_1 = require("./config/config");
const response_1 = require("./utils/response");
const routes_1 = __importDefault(require("./routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const db_1 = __importDefault(require("./config/db"));
const app = (0, express_1.default)();
// 🛡️ Fresh 'n' Fast - Elite FIFO Migration Hub
// Automatically provisions the 'inventory_batches' table to track purchase costs per batch.
const initFIFOEngine = async () => {
    try {
        await db_1.default.execute(`
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
        console.log("🏙️ FIFO Batch Oracle Profile: INITIALIZED & READY. 🛡️🚀");
    }
    catch (err) {
        console.error("⛔ FIFO Initialization Barrier:", err);
    }
};
const initTenantEngine = async () => {
    try {
        await db_1.default.execute(`
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
        console.log("🏢 SaaS Tenant Engine: INITIALIZED & READY. 🚀");
    }
    catch (err) {
        console.error("⛔ Tenant Initialization Barrier:", err);
    }
};
const initDistributionEngine = async () => {
    try {
        await db_1.default.execute(`
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
        // 🛡️ ELITE BRANCH SEGREGATION SYNC
        try {
            await db_1.default.execute(`ALTER TABLE sales_orders ADD COLUMN branch_id INT DEFAULT NULL`);
        }
        catch (err) {
            if (err.errno !== 1060)
                console.error("Sales Order Column Sync:", err.message);
        }
        try {
            await db_1.default.execute(`ALTER TABLE sales_orders ADD CONSTRAINT fk_sales_order_branch FOREIGN KEY (branch_id) REFERENCES partner_branches(branch_id) ON DELETE SET NULL`);
        }
        catch (err) {
            if (err.errno !== 1061)
                console.error("Sales Order Constraint Sync:", err.message);
        }
        // 🛡️ ELITE PROCUREMENT SEGREGATION SYNC
        try {
            await db_1.default.execute(`ALTER TABLE purchase_orders ADD COLUMN branch_id INT DEFAULT NULL`);
        }
        catch (err) {
            if (err.errno !== 1060)
                console.error("Purchase Order Column Sync:", err.message);
        }
        try {
            await db_1.default.execute(`ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchase_order_branch FOREIGN KEY (branch_id) REFERENCES partner_branches(branch_id) ON DELETE SET NULL`);
        }
        catch (err) {
            if (err.errno !== 1061)
                console.error("Purchase Order Constraint Sync:", err.message);
        }
        // 🛡️ SOFT DELETE ENGINE SYNC
        const tablesToSync = ['production_logs', 'sales_orders', 'sales_returns'];
        for (const table of tablesToSync) {
            try {
                await db_1.default.execute(`ALTER TABLE ${table} ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`);
            }
            catch (err) {
                if (err.errno !== 1060)
                    console.error(`Soft Delete Sync (${table}):`, err.message);
            }
        }
        // 🛡️ WASTAGE REPORTING ENGINE SYNC
        try {
            await db_1.default.execute(`ALTER TABLE wastage ADD COLUMN menu_item_id INT DEFAULT NULL AFTER product_id`);
        }
        catch (err) {
            if (err.errno !== 1060)
                console.error("Wastage Column Sync (menu_item):", err.message);
        }
        try {
            await db_1.default.execute(`ALTER TABLE wastage ADD COLUMN vendor_id INT DEFAULT NULL AFTER menu_item_id`);
        }
        catch (err) {
            if (err.errno !== 1060)
                console.error("Wastage Column Sync (vendor_id):", err.message);
        }
        try {
            await db_1.default.execute(`ALTER TABLE wastage ADD CONSTRAINT fk_wastage_menu_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(menu_item_id) ON DELETE SET NULL`);
        }
        catch (err) {
            if (err.errno !== 1061)
                console.error("Wastage Constraint Sync (menu_item):", err.message);
        }
        try {
            await db_1.default.execute(`ALTER TABLE wastage ADD CONSTRAINT fk_wastage_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE SET NULL`);
        }
        catch (err) {
            if (err.errno !== 1061)
                console.error("Wastage Constraint Sync (vendor_id):", err.message);
        }
        // 🛡️ SALESMAN MODULE ENGINE SYNC
        try {
            await db_1.default.execute(`
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
        }
        catch (err) {
            console.error("Salesman Table Sync:", err.message);
        }
        try {
            await db_1.default.execute(`ALTER TABLE sales_orders ADD COLUMN salesman_id INT NULL AFTER admin_id`);
        }
        catch (err) {
            if (err.errno !== 1060)
                console.error("Sales Order Salesman Sync:", err.message);
        }
        try {
            await db_1.default.execute(`ALTER TABLE sales_orders ADD CONSTRAINT fk_sales_salesman FOREIGN KEY (salesman_id) REFERENCES salesmen(salesman_id) ON DELETE SET NULL`);
        }
        catch (err) {
            if (err.errno !== 1061)
                console.error("Sales Order Salesman Constraint:", err.message);
        }
        // 🛡️ OPERATIONAL EXPENSES SYNC
        try {
            await db_1.default.execute(`
                CREATE TABLE IF NOT EXISTS operational_expenses (
                    expense_id INT AUTO_INCREMENT PRIMARY KEY,
                    type ENUM('Labor Expense', 'Other Expense') NOT NULL,
                    category VARCHAR(255) NOT NULL,
                    amount DECIMAL(15, 3) NOT NULL,
                    expense_date DATE NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB
            `);
        }
        catch (err) {
            console.error("Operational Expenses Table Sync:", err.message);
        }
        console.log("🚚 Distribution Branch Hub: INITIALIZED & READY. 🛡️🚀");
    }
    catch (err) {
        console.error("⛔ Distribution Initialization Barrier:", err);
    }
};
initTenantEngine();
// FIFO and Distribution tables are initialized directly via schema.sql and migrations in tenant databases.
// We disable these startup syncs because kms_master is now a clean control DB and does not contain operational tables.
// Middlewares
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false
}));
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5177',
    'http://localhost:5176', // Front-end dev port from package.json script
    config_1.config.corsOrigin, // Auto-read from .env.production
    'https://kms.ansoftt.com',
    'https://api.kms.ansoftt.com',
    'https://admin.kms.ansoftt.com'
];
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.use('/api/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.use((0, morgan_1.default)(config_1.config.env === 'development' ? 'dev' : 'combined'));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Global Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', env: config_1.config.env });
});
// Routes
app.get('/api/debug-db', async (req, res) => { const [rows] = await db_1.default.query('SELECT DATABASE() as db'); res.json(rows[0]); });
app.use('/api', routes_1.default);
// 404 Handler
app.use((req, res) => {
    return (0, response_1.errorResponse)(res, 'Route not found', 404);
});
// Global Error Handler
app.use(error_middleware_1.errorHandler);
exports.default = app;
