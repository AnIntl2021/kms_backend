import { Request, Response } from 'express';
import pool from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

export const updateDispatchStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // pending, in_transit, delivered
    
    await pool.execute(
      'UPDATE sales_orders SET dispatch_status = ? WHERE sale_id = ?',
      [status, id]
    );

    // If delivered, we could trigger stock movements or other logic here
    
    return successResponse(res, null, `Dispatch updated to ${status}`);
  } catch (error) {
    return errorResponse(res, 'Failed to update status', 500, error);
  }
};
