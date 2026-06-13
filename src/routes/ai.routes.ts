import { Router } from 'express';
import { chatWithAI } from '../controllers/ai.controller';

const router = Router();

// Endpoint for AI assistant chat
router.post('/chat', chatWithAI);

export default router;
