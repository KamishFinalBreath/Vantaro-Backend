import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes/index.js';
import webhooksRoutes from './routes/webhooks.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(morgan('combined'));

  // Webhook routes need the RAW body for signature verification, so they are
  // mounted with express.raw() BEFORE the global JSON parser consumes the stream.
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRoutes);

  // JSON body parsing for all remaining (non-webhook) routes.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;