import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });

const testConnection = async () => {
    console.log(`🔍 Attempting to connect to Live DB at ${process.env.DB_HOST}...`);
    
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        connectTimeout: 10000, // 10 seconds
    };

    try {
        const connection = await mysql.createConnection(config);
        console.log("✅ SUCCESS: Connection established!");
        await connection.end();
    } catch (err: any) {
        console.error("❌ FAILURE: Could not connect.");
        console.error("Error Code:", err.code);
        console.error("Error Message:", err.message);
        
        if (err.code === 'ETIMEDOUT') {
            console.log("\n💡 DIAGNOSIS: Network Timeout.");
            console.log("1. Check if the server's firewall (UFW) allows port 3306.");
            console.log("2. Check if your current IP is whitelisted on the server.");
            console.log("3. Ensure MySQL is set to listen on 0.0.0.0 (not just localhost).");
        }
    }
};

testConnection();
