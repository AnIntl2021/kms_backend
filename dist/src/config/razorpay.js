"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const razorpay_1 = __importDefault(require("razorpay"));
const config_1 = require("./config");
const razorpay = new razorpay_1.default({
    key_id: config_1.config.razorpay.keyId,
    key_secret: config_1.config.razorpay.keySecret,
});
exports.default = razorpay;
