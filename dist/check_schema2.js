import pool from './src/config/db.js';
pool.execute('DESCRIBE sales_returns').then(res => { console.log(res[0]); process.exit(0); }).catch(console.error);
