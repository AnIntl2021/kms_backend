import express from 'express';
import { getAssets, createAsset, updateAsset } from '../controllers/assetsController';

const router = express.Router();

router.get('/', getAssets);
router.post('/', createAsset);
router.put('/:id', updateAsset);

export default router;
