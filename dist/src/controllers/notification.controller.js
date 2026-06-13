import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
export const getNotifications = async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM notifications WHERE is_read = FALSE ORDER BY created_at DESC LIMIT 50');
        return successResponse(res, rows);
    }
    catch (error) {
        return errorResponse(res, 'Failed to fetch notifications', 500, error);
    }
};
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.execute('UPDATE notifications SET is_read = TRUE WHERE notification_id = ?', [id]);
        return successResponse(res, null, 'Notification marked as read');
    }
    catch (error) {
        return errorResponse(res, 'Failed to update notification', 500, error);
    }
};
export const clearAll = async (req, res) => {
    try {
        await pool.execute('UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE');
        return successResponse(res, null, 'All notifications cleared');
    }
    catch (error) {
        return errorResponse(res, 'Failed to clear notifications', 500, error);
    }
};
