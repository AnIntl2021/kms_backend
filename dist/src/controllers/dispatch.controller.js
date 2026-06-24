"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDispatchStatus = void 0;
const db_1 = __importDefault(require("../config/db"));
const response_1 = require("../utils/response");
const updateDispatchStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // pending, in_transit, delivered
        const [result] = await db_1.default.execute('UPDATE sales_orders SET status = ? WHERE sales_order_id = ?', [status, id]);
        if (result.affectedRows === 0) {
            return (0, response_1.errorResponse)(res, `No order found with ID ${id}`, 404);
        }
        return (0, response_1.successResponse)(res, null, `Order status updated to ${status}`);
    }
    catch (error) {
        return (0, response_1.errorResponse)(res, 'Failed to update status', 500, error);
    }
};
exports.updateDispatchStatus = updateDispatchStatus;
