import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err);

  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  return errorResponse(res, message, status, err);
};
