"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_controller_1 = require("../controllers/ai.controller");
const router = (0, express_1.Router)();
// Endpoint for AI assistant chat
router.post('/chat', ai_controller_1.chatWithAI);
exports.default = router;
