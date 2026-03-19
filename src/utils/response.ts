import { Response } from 'express';

export const successResponse = (res: Response, data: any, message: string = 'Success', status: number = 200) => {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const errorResponse = (res: Response, message: string = 'Internal Server Error', status: number = 500, error: any = null) => {
  return res.status(status).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? error : undefined,
  });
};
