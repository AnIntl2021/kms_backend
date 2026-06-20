import { Router } from 'express';
import { 
  getSubscriptionStatus, 
  createSubscriptionOrder, 
  verifySubscriptionPayment, 
  getCounters, 
  createCounter, 
  deleteCounter,
  getActiveSession,
  openSession,
  getSessionSummary,
  closeSession
} from '../controllers/subscription.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Secure all subscription billing and POS counter paths
router.use(authMiddleware);

router.get('/status', getSubscriptionStatus);
router.post('/create-order', createSubscriptionOrder);
router.post('/verify-payment', verifySubscriptionPayment);

router.get('/counters', getCounters);
router.post('/counters', createCounter);
router.delete('/counters/:id', deleteCounter);

router.get('/counters/active-session', getActiveSession);
router.post('/counters/sessions/open', openSession);
router.get('/counters/sessions/:id/summary', getSessionSummary);
router.post('/counters/sessions/close', closeSession);

export default router;
