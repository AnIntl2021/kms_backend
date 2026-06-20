import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const updateDispatchStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // pending, in_transit, delivered
    
    const [result]: any = await pool.execute(
      'UPDATE sales_orders SET status = ? WHERE sales_order_id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return errorResponse(res, `No order found with ID ${id}`, 404);
    }

    return successResponse(res, null, `Order status updated to ${status}`);
  } catch (error) {
    return errorResponse(res, 'Failed to update status', 500, error);
  }
};
