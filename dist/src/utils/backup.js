"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBackup = runBackup;
const config_1 = require("../config/config");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const execPromise = (0, util_1.promisify)(child_process_1.exec);
// Configuration
const BACKUP_DIR = path_1.default.join(process.cwd(), 'backups');
const MAX_BACKUPS = 7; // Keep 7 days
/**
 * 🛡️ ELITE DATABASE BACKUP ORACLE
 * Creates a timestamped .sql dump and rotates old files.
 */
async function runBackup() {
    try {
        // 1. Ensure backup directory exists
        if (!fs_1.default.existsSync(BACKUP_DIR)) {
            fs_1.default.mkdirSync(BACKUP_DIR, { recursive: true });
        }
        // 2. Prepare file name (e.g., backup_2024-05-06.sql)
        const timestamp = new Date().toISOString().split('T')[0];
        const fileName = `kms_backup_${timestamp}.sql`;
        const filePath = path_1.default.join(BACKUP_DIR, fileName);
        // 3. Construct mysqldump command
        const host = config_1.config.db.host || 'localhost';
        const user = config_1.config.db.user || 'root';
        const password = config_1.config.db.pass || '';
        const dbName = config_1.config.db.name || 'kms_master';
        // Windows usually needs the password right after -p with no space
        const passPart = password ? `-p${password}` : '';
        const command = `mysqldump -h ${host} -u ${user} ${passPart} ${dbName} > "${filePath}"`;
        console.log(`🚀 Starting database backup for ${dbName}...`);
        await execPromise(command);
        console.log(`✅ Backup created: ${fileName}`);
        // 4. Cleanup old backups (Keep only the latest 7)
        const files = fs_1.default.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.sql'))
            .map(f => ({ name: f, time: fs_1.default.statSync(path_1.default.join(BACKUP_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time); // Newest first
        if (files.length > MAX_BACKUPS) {
            const filesToDelete = files.slice(MAX_BACKUPS);
            for (const file of filesToDelete) {
                fs_1.default.unlinkSync(path_1.default.join(BACKUP_DIR, file.name));
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
