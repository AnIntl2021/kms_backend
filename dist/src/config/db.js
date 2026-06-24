"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.masterPool = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const config_1 = require("./config");
const tenantContext_1 = require("../middleware/tenantContext");
const dbConfig = {
    host: config_1.config.db.host,
    user: config_1.config.db.user,
    password: config_1.config.db.pass,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
};
// Cache for our tenant pools
const poolCache = new Map();
// Function to get the correct pool for the current request
const getPool = () => {
    const store = tenantContext_1.tenantContext.getStore();
    // Default to master DB if no context exists (e.g. startup scripts, login)
    const dbName = store?.dbName || config_1.config.db.name;
    // Type check: handle the case where dbName might be undefined in config
    const safeDbName = dbName || 'kms_master';
    if (!poolCache.has(safeDbName)) {
        console.log(`🔌 Initializing new connection pool for database: ${safeDbName}`);
        const newPool = promise_1.default.createPool({
            ...dbConfig,
            database: safeDbName
        });
        // Apply the Kuwait Time constraint to this new pool
        newPool.on('connection', (connection) => {
            connection.query("SET time_zone = '+03:00'");
        });
        poolCache.set(safeDbName, newPool);
    }
    return poolCache.get(safeDbName);
};
// Create a Proxy that looks exactly like a standard mysql2 Pool
// but dynamically forwards execute/query/getConnection to the correct pool
const dynamicPoolProxy = new Proxy({}, {
    get: (target, prop) => {
        const activePool = getPool();
        const value = activePool[prop];
        if (typeof value === 'function') {
            return value.bind(activePool);
        }
        return value;
    }
});
exports.masterPool = promise_1.default.createPool({
    ...dbConfig,
    database: 'kms_master'
});
exports.default = dynamicPoolProxy;
