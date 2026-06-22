"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAll = exports.markAsRead = exports.getNotifications = void 0;
const db_js_1 = __importDefault(require("../config/db.js"));
const response_js_1 = require("../utils/response.js");
const getNotifications = async (req, res) => {
    try {
        const [rows] = await db_js_1.default.execute('SELECT * FROM notifications WHERE is_read = FALSE ORDER BY created_at DESC LIMIT 50');
        return (0, response_js_1.successResponse)(res, rows);
    }
    catch (error) {
        return (0, response_js_1.errorResponse)(res, 'Failed to fetch notifications', 500, error);
    }
};
exports.getNotifications = getNotifications;
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await db_js_1.default.execute('UPDATE notifications SET is_read = TRUE WHERE notification_id = ?', [id]);
        return (0, response_js_1.successResponse)(res, null, 'Notification marked as read');
    }
    catch (error) {
        return (0, response_js_1.errorResponse)(res, 'Failed to update notification', 500, error);
    }
};
exports.markAsRead = markAsRead;
const clearAll = async (req, res) => {
    try {
        await db_js_1.default.execute('UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE');
        return (0, response_js_1.successResponse)(res, null, 'All notifications cleared');
    }
    catch (error) {
        return (0, response_js_1.errorResponse)(res, 'Failed to clear notifications', 500, error);
    }
};
exports.clearAll = clearAll;
