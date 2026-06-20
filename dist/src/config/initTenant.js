import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { config } from './config';
export const provisionTenantDatabase = async (dbName, adminDetails) => {
    // 1. Create a raw connection without specifying database
    const connection = await mysql.createConnection({
        host: config.db.host,
        user: config.db.user,
        password: config.db.pass
    });
    try {
        // 2. Create the new database
        await connection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        console.log(`✅ Tenant database '${dbName}' created successfully.`);
        // 3. Connect specifically to the new database
        await connection.changeUser({ database: dbName });
        // 4. Read schema.sql
        const schemaPath = path.join(process.cwd(), 'schema.sql');
        let schemaSql = fs.readFileSync(schemaPath, 'utf8');
        // Remove the hardcoded database switch so it executes in the new db Name!
        schemaSql = schemaSql.replace(/CREATE DATABASE IF NOT EXISTS kms_master;/g, '');
        schemaSql = schemaSql.replace(/USE kms_master;/g, '');
        // Execute the whole script using mysql2's multipleStatements option
        const pool = await mysql.createPool({
            host: config.db.host,
            user: config.db.user,
            password: config.db.pass,
            database: dbName,
            multipleStatements: true
        });
        console.log(`⏳ Importing schema.sql into '${dbName}'...`);
        await pool.query(schemaSql);
        console.log(`✅ Schema imported successfully into '${dbName}'.`);
        // 5. Seed the default superadmin for this tenant
        console.log(`⏳ Seeding default admin for '${dbName}'...`);
        const hash = await bcrypt.hash(adminDetails.password || 'admin123', 10);
        // Ensure role 1 is super_admin (schema.sql already has roles inserted, but we insert admin)
        await pool.execute('INSERT INTO admins (username, email, password, role_id, first_name, status) VALUES (?, ?, ?, ?, ?, ?)', [adminDetails.username || 'admin', adminDetails.email, hash, 1, adminDetails.name || 'Admin', 'active']);
        console.log(`✅ Admin seeded successfully for '${dbName}'.`);
        // 6. Seed initial settings (Company Name)
        if (adminDetails.name) {
            await pool.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', ['company_name', adminDetails.name]);
            console.log(`✅ Default settings seeded for '${dbName}'.`);
        }
        await pool.end();
    }
    catch (error) {
        console.error(`❌ Failed to provision tenant database '${dbName}':`, error);
        throw error;
    }
    finally {
        await connection.end();
    }
};
