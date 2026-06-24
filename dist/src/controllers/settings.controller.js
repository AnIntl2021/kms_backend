"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.triggerBackup = exports.updateSettings = exports.getSettings = void 0;
const db_1 = __importDefault(require("../config/db"));
const response_1 = require("../utils/response");
const backup_1 = require("../utils/backup");
const tenantContext_1 = require("../middleware/tenantContext");
const getSettings = async (req, res) => {
    try {
        let targetDb = 'kms_master';
        const tenantIdParam = req.query.tenant || req.headers['x-tenant-id'];
        if (tenantIdParam) {
            // Find tenant db
            const [tenants] = await db_1.default.execute('SELECT db_name FROM tenants WHERE tenant_id = ? OR name = ?', [tenantIdParam, tenantIdParam]);
            if (tenants.length > 0) {
                targetDb = tenants[0].db_name;
            }
        }
        else {
            const currentDb = tenantContext_1.tenantContext.getStore()?.dbName;
            if (currentDb)
                targetDb = currentDb;
        }
        await tenantContext_1.tenantContext.run({ dbName: targetDb }, async () => {
            const [settings] = await db_1.default.execute('SELECT * FROM system_settings');
            // Map to a more useful object
            const settingsObj = settings.reduce((acc, curr) => {
                acc[curr.setting_key] = curr.setting_value;
                return acc;
            }, {});
            // If company_name is empty, try to fetch it from the master db tenants table
            let tenantPlan = 'Basic';
            let companyName = '';
            if (targetDb && targetDb !== 'kms_master') {
                await tenantContext_1.tenantContext.run({ dbName: 'kms_master' }, async () => {
                    const [tenantRows] = await db_1.default.execute('SELECT plan, name FROM tenants WHERE db_name = ?', [targetDb]);
                    if (tenantRows && tenantRows.length > 0) {
                        tenantPlan = tenantRows[0].plan;
                        companyName = tenantRows[0].name;
                    }
                });
                if (companyName) {
                    settingsObj.company_name = companyName;
                    await db_1.default.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', ['company_name', companyName, companyName]);
                    if (!settingsObj.receipt_header) {
                        settingsObj.receipt_header = companyName;
                        await db_1.default.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', ['receipt_header', companyName, companyName]);
                    }
                }
            }
            if (!settingsObj.receipt_footer) {
                settingsObj.receipt_footer = "Thank you for your visit!\nPlease come again.";
                await db_1.default.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', ['receipt_footer', settingsObj.receipt_footer, settingsObj.receipt_footer]);
            }
            settingsObj.subscription_plan = tenantPlan;
            return (0, response_1.successResponse)(res, settingsObj);
        });
    }
    catch (error) {
        console.error('GetSettings Error:', error);
        return (0, response_1.errorResponse)(res, 'Failed to fetch settings', 500, error);
    }
};
exports.getSettings = getSettings;
const updateSettings = async (req, res) => {
    try {
        const settings = req.body; // Expecting { key: value, ... }
        const queries = Object.keys(settings).map(key => {
            return db_1.default.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?', [key, settings[key], settings[key]]);
        });
        await Promise.all(queries);
        return (0, response_1.successResponse)(res, null, 'Settings updated successfully');
    }
    catch (error) {
        console.error('UpdateSettings Error:', error);
        return (0, response_1.errorResponse)(res, 'Failed to update settings', 500, error);
    }
};
exports.updateSettings = updateSettings;
const triggerBackup = async (req, res) => {
    const result = await (0, backup_1.runBackup)();
    if (result.success) {
        return (0, response_1.successResponse)(res, { file: result.file }, 'Backup created and rotated successfully');
    }
    else {
        return (0, response_1.errorResponse)(res, 'Backup failed', 500, result.error);
    }
};
exports.triggerBackup = triggerBackup;
