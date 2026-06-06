import express from 'express';
import { getLiabilities, createLiability, updateLiability } from '../controllers/liabilitiesController';

const router = express.Router();

router.get('/', getLiabilities);
router.post('/', createLiability);
router.put('/:id', updateLiability);

export default router;
