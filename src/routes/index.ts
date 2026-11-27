import { Router } from 'express';
import productsRoutes from './products.routes.js';
import cartRoutes from './cart.routes.js';
import checkoutRoutes from './checkout.routes.js';
import ordersRoutes from './orders.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vantaro-backend', time: new Date().toISOString() });
});

router.use('/products', productsRoutes);
router.use('/cart', cartRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/orders', ordersRoutes);

export default router;