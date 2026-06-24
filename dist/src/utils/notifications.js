"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAndNotifyLowStock = exports.sendNotification = void 0;
const db_js_1 = __importDefault(require("../config/db.js"));
/**
 * Global Notification Trigger
 * @param message The alert message
 * @param type 'info', 'warning', 'success', 'danger'
 */
const sendNotification = async (message, type = 'info') => {
    try {
        await db_js_1.default.execute('INSERT INTO notifications (message, type) VALUES (?, ?)', [message, type]);
        console.log(`🔔 Global Notification Sent: ${message}`);
    }
    catch (error) {
        console.error('Failed to send notification:', error);
    }
};
exports.sendNotification = sendNotification;
/**
 * Low Stock Oracle
 * Checks if an item has fallen below its safety threshold
 */
const checkAndNotifyLowStock = async (itemId) => {
    try {
        const [rows] = await db_js_1.default.execute('SELECT name_en, current_stock, min_stock_level FROM inventory_items WHERE inventory_item_id = ?', [itemId]);
        if (rows.length > 0) {
            const item = rows[0];
            if (Number(item.current_stock) <= Number(item.min_stock_level)) {
                const msg = `⚠️ LOW STOCK ALERT: ${item.name_en} is at ${item.current_stock}. (Threshold: ${item.min_stock_level})`;
                // Only send if it doesn't already exist as unread to avoid spamming
                const [existing] = await db_js_1.default.execute('SELECT notification_id FROM notifications WHERE message = ? AND is_read = FALSE', [msg]);
                if (existing.length === 0) {
                    await (0, exports.sendNotification)(msg, 'warning');
                }
            }
        }
    }
    catch (error) {
        console.error('Low stock check failed:', error);
    }
};
exports.checkAndNotifyLowStock = checkAndNotifyLowStock;
