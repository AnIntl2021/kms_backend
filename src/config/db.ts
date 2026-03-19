import mysql, { PoolOptions } from 'mysql2/promise';
import { config } from './config';

const dbConfig: PoolOptions = {
  host: config.db.host,
  user: config.db.user,
  password: config.db.pass,
  database: config.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

export default pool;
