"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const env = process.env.NODE_ENV || 'development';
const envFile = `.env.${env}`;
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), envFile) });
// Fallback to default .env if specific stage file not found or for shared variables
dotenv_1.default.config();
exports.config = {
    env,
    port: parseInt(process.env.PORT || '5000', 10),
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        pass: process.env.DB_PASS,
        name: process.env.DB_NAME,
    },
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID || '',
        keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    }
};
