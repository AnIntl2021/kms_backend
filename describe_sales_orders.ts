import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
  database: 'kms_ansoftt_09f7',
};

async function run() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows]: any = await connection.execute('DESCRIBE sales_orders');
    console.log('Columns in sales_orders:', rows.map((r: any) => `${r.Field} (${r.Type})`));
    await connection.end();
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

run();
