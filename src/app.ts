import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config/config';
import { errorResponse } from './utils/response';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import pool from './config/db';

const app = express();

// 🛡️ Fresh 'n' Fast - Elite FIFO Migration Hub
// Automatically provisions the 'inventory_batches' table to track purchase costs per batch.
const initFIFOEngine = async () => {
    try {
        await pool.execute(`
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
    } catch (err) {
        console.error("⛔ FIFO Initialization Barrier:", err);
    }
};

const initDistributionEngine = async () => {
    try {
        await pool.execute(`
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
            await pool.execute(`ALTER TABLE sales_orders ADD COLUMN branch_id INT DEFAULT NULL`);
        } catch (err: any) {
            if (err.errno !== 1060) console.error("Sales Order Column Sync:", err.message);
        }
        try {
            await pool.execute(`ALTER TABLE sales_orders ADD CONSTRAINT fk_sales_order_branch FOREIGN KEY (branch_id) REFERENCES partner_branches(branch_id) ON DELETE SET NULL`);
        } catch (err: any) {
            if (err.errno !== 1061) console.error("Sales Order Constraint Sync:", err.message);
        }

        // 🛡️ ELITE PROCUREMENT SEGREGATION SYNC
        try {
            await pool.execute(`ALTER TABLE purchase_orders ADD COLUMN branch_id INT DEFAULT NULL`);
        } catch (err: any) {
            if (err.errno !== 1060) console.error("Purchase Order Column Sync:", err.message);
        }
        try {
            await pool.execute(`ALTER TABLE purchase_orders ADD CONSTRAINT fk_purchase_order_branch FOREIGN KEY (branch_id) REFERENCES partner_branches(branch_id) ON DELETE SET NULL`);
        } catch (err: any) {
            if (err.errno !== 1061) console.error("Purchase Order Constraint Sync:", err.message);
        }

        // 🛡️ SOFT DELETE ENGINE SYNC
        const tablesToSync = ['production_logs', 'sales_orders', 'sales_returns'];
        for (const table of tablesToSync) {
            try {
                await pool.execute(`ALTER TABLE ${table} ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL`);
            } catch (err: any) {
                if (err.errno !== 1060) console.error(`Soft Delete Sync (${table}):`, err.message);
            }
        }

        console.log("🚚 Distribution Branch Hub: INITIALIZED & READY. 🛡️🚀");
    } catch (err) {
        console.error("⛔ Distribution Initialization Barrier:", err);
    }
};

initFIFOEngine();
initDistributionEngine();

// Middlewares
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5177',
  config.corsOrigin, // Auto-read from .env.production (https://freshnfastkw.com)
  'https://freshnfastkw.com',
  'https://www.freshnfastkw.com',
  'https://api.freshnfastkw.com'
];

app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Policy violation: CORS origin mismatch. Access denied. 🛡️'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', env: config.env });
});

// Routes
app.use('/api', routes);

// 404 Handler
app.use((req, res) => {
  return errorResponse(res, 'Route not found', 404);
});

// Global Error Handler
app.use(errorHandler);

export default app;
