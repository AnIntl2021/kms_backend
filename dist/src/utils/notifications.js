import pool from '../config/db.js';
/**
 * Global Notification Trigger
 * @param message The alert message
 * @param type 'info', 'warning', 'success', 'danger'
 */
export const sendNotification = async (message, type = 'info') => {
    try {
        await pool.execute('INSERT INTO notifications (message, type) VALUES (?, ?)', [message, type]);
        console.log(`🔔 Global Notification Sent: ${message}`);
    }
    catch (error) {
        console.error('Failed to send notification:', error);
    }
};
/**
 * Low Stock Oracle
 * Checks if an item has fallen below its safety threshold
 */
export const checkAndNotifyLowStock = async (itemId) => {
    try {
        const [rows] = await pool.execute('SELECT name_en, current_stock, min_stock_level FROM inventory_items WHERE inventory_item_id = ?', [itemId]);
        if (rows.length > 0) {
            const item = rows[0];
            if (Number(item.current_stock) <= Number(item.min_stock_level)) {
                const msg = `⚠️ LOW STOCK ALERT: ${item.name_en} is at ${item.current_stock}. (Threshold: ${item.min_stock_level})`;
                // Only send if it doesn't already exist as unread to avoid spamming
                const [existing] = await pool.execute('SELECT notification_id FROM notifications WHERE message = ? AND is_read = FALSE', [msg]);
                if (existing.length === 0) {
                    await sendNotification(msg, 'warning');
                }
            }
        }
    }
    catch (error) {
        console.error('Low stock check failed:', error);
    }
};
