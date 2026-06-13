import { config } from '../config/config';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
const execPromise = promisify(exec);
// Configuration
const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 7; // Keep 7 days
/**
 * 🛡️ ELITE DATABASE BACKUP ORACLE
 * Creates a timestamped .sql dump and rotates old files.
 */
export async function runBackup() {
    try {
        // 1. Ensure backup directory exists
        if (!fs.existsSync(BACKUP_DIR)) {
            fs.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        // 2. Prepare file name (e.g., backup_2024-05-06.sql)
        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `fresh_n_fast_backup_${timestamp}.sql`;
        const filePath = path.join(BACKUP_DIR, fileName);
        // 3. Construct mysqldump command
        const host = config.db.host || 'localhost';
        const user = config.db.user || 'root';
        const password = config.db.pass || '';
        const dbName = config.db.name || 'fresh_n_fast_db';
        // Windows usually needs the password right after -p with no space
        const passPart = password ? `-p${password}` : '';
        const command = `mysqldump -h ${host} -u ${user} ${passPart} ${dbName} > "${filePath}"`;
        console.log(`🚀 Starting database backup for ${dbName}...`);
        await execPromise(command);
        console.log(`✅ Backup created: ${fileName}`);
        // 4. Cleanup old backups (Keep only the latest 7)
        const files = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.sql'))
            .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time); // Newest first
        if (files.length > MAX_BACKUPS) {
            const filesToDelete = files.slice(MAX_BACKUPS);
            for (const file of filesToDelete) {
                fs.unlinkSync(path.join(BACKUP_DIR, file.name));
                console.log(`🗑️ Deleted old backup: ${file.name}`);
            }
        }
        return { success: true, file: fileName };
    }
    catch (error) {
        console.error('❌ Backup failed:', error);
        return { success: false, error };
    }
}
