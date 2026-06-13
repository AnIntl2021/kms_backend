export const successResponse = (res, data, message = 'Success', status = 200) => {
    return res.status(status).json({
        success: true,
        message,
        data,
    });
};
export const errorResponse = (res, message = 'Internal Server Error', status = 500, error = null) => {
    return res.status(status).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? error : undefined,
    });
};
