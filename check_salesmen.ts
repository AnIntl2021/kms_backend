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

async function testQueries() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to kms_chittidosa_22f4');

    console.log('\n--- Testing Query 1: SELECT * FROM salesmen ---');
    try {
      const [rows] = await connection.execute('SELECT * FROM salesmen WHERE deleted_at IS NULL ORDER BY name_en ASC');
      console.log('Success! Found rows:', (rows as any).length);
    } catch (e: any) {
      console.error('Error in Query 1:', e.message);
    }

    console.log('\n--- Testing Query 2: Salesman Performance ---');
    try {
      const [rows] = await connection.execute(`
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
      console.log('Success! Found performance rows:', (rows as any).length);
    } catch (e: any) {
      console.error('Error in Query 2:', e.message);
    }

    await connection.end();
  } catch (error: any) {
    console.error('Connection failed:', error.message);
  }
}

testQueries();
