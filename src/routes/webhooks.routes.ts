import { Router } from 'express';
import { stripeWebhook } from '../controllers/webhooks.controller.js';
import { printifyWebhook } from '../controllers/printify-webhooks.controller.js';

const router = Router();

// NOTE: This router is mounted at /api/webhooks with express.raw() applied at
// the app level (before the JSON parser), so req.body is a Buffer here.
router.post('/stripe', stripeWebhook);
router.post('/printify', printifyWebhook);

export default router;