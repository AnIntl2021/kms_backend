import { errorResponse } from '../utils/response';
export const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${req.method} ${req.path}:`, err);
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    return errorResponse(res, message, status, err);
};
