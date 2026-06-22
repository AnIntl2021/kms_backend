"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = void 0;
const db_1 = __importDefault(require("../config/db"));
const logAudit = async (adminId, action, entityName, entityId = null, oldValues = null, newValues = null, req = null) => {
    try {
        const ipAddress = req ? req.ip : null;
        const userAgent = req ? req.get('user-agent') : null;
        await db_1.default.execute(`INSERT INTO audit_logs (admin_id, action, entity_name, entity_id, old_values, new_values, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            adminId,
            action,
            entityName,
            entityId,
            oldValues ? JSON.stringify(oldValues) : null,
            newValues ? JSON.stringify(newValues) : null,
            ipAddress,
            userAgent
        ]);
    }
    catch (error) {
        console.error('Audit Log Error:', error);
    }
};
exports.logAudit = logAudit;
