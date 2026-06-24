"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const response_1 = require("../utils/response");
const errorHandler = (err, req, res, next) => {
    console.error(`[Error] ${req.method} ${req.path}:`, err);
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    return (0, response_1.errorResponse)(res, message, status, err);
};
exports.errorHandler = errorHandler;
