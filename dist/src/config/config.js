import dotenv from 'dotenv';
import path from 'path';
const env = process.env.NODE_ENV || 'development';
const envFile = `.env.${env}`;
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
// Fallback to default .env if specific stage file not found or for shared variables
dotenv.config();
export const config = {
    env,
    port: parseInt(process.env.PORT || '5000', 10),
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        name: process.env.DB_NAME,
    },
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
    corsOrigin: process.env.CORS_ORIGIN || '*',
};
