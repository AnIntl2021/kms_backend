import mysql from 'mysql2/promise';
import { config } from './config';
const dbConfig = {
    host: config.db.host,
    user: config.db.user,
    password: config.db.pass,
    database: config.db.name,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
};
const pool = mysql.createPool(dbConfig);
// Force every connection in the pool to explicitly use Kuwait Time (+03:00)
// This ensures that sales made at 22:00 UTC on May 31st are correctly shifted to 01:00 AM June 1st, exactly as the Excel sheet calculated.
pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+03:00'");
});
export default pool;
