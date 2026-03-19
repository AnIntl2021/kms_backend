import { Router } from 'express';
import authRoutes from './auth.routes';
import businessRoutes from './business.routes';
import inventoryRoutes from './inventory.routes';
import vendorRoutes from './vendor.routes';
import purchaseRoutes from './purchase.routes';
import menuRoutes from './menu.routes';
import branchRoutes from './branch.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/business', businessRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/vendors', vendorRoutes);
router.use('/purchases', purchaseRoutes);
router.use('/menu', menuRoutes);
router.use('/branches', branchRoutes);

export default router;
