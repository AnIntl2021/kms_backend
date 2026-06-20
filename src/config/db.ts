import mysql, { PoolOptions, Pool } from 'mysql2/promise';
import { config } from './config';
import { tenantContext } from '../middleware/tenantContext';

const dbConfig: PoolOptions = {
  host: config.db.host,
  user: config.db.user,
  password: config.db.pass,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Cache for our tenant pools
const poolCache = new Map<string, Pool>();

// Function to get the correct pool for the current request
const getPool = (): Pool => {
  const store = tenantContext.getStore();
  // Default to master DB if no context exists (e.g. startup scripts, login)
  const dbName = store?.dbName || config.db.name;
  
  // Type check: handle the case where dbName might be undefined in config
  const safeDbName = dbName || 'kms_master';

  if (!poolCache.has(safeDbName)) {
    console.log(`🔌 Initializing new connection pool for database: ${safeDbName}`);
    const newPool = mysql.createPool({
      ...dbConfig,
      database: safeDbName
    });

    // Apply the Kuwait Time constraint to this new pool
    newPool.on('connection', (connection) => {
      connection.query("SET time_zone = '+03:00'");
    });

    poolCache.set(safeDbName, newPool);
  }

  return poolCache.get(safeDbName)!;
};

// Create a Proxy that looks exactly like a standard mysql2 Pool
// but dynamically forwards execute/query/getConnection to the correct pool
const dynamicPoolProxy = new Proxy({} as Pool, {
  get: (target, prop) => {
    const activePool = getPool();
    const value = activePool[prop as keyof Pool];
    if (typeof value === 'function') {
      return value.bind(activePool);
    }
    return value;
  }
});

export const masterPool = mysql.createPool({
  ...dbConfig,
  database: 'kms_master'
});

export default dynamicPoolProxy;
