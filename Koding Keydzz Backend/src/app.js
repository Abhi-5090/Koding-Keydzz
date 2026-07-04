import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFound, errorHandler } from './middlewares/error.js';
import { apiLimiter } from './middlewares/rateLimit.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser tools (no origin) and whitelisted origins.
        if (!origin || env.clientOrigins.includes(origin)) {
          return callback(null, true);
        }
        // In non-production, accept any localhost/127.0.0.1 port so the Vite
        // dev servers work even if their port drifts (5175 -> 5176 -> 5177…).
        if (
          env.NODE_ENV !== 'production' &&
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
        ) {
          return callback(null, true);
        }
        return callback(new Error(`CORS: origin ${origin} not allowed`));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(mongoSanitize());

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  app.use('/api', apiLimiter);

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      data: { name: 'Koding Keydzz API', version: 'v1' },
      message: 'Welcome to Koding Keydzz',
    });
  });

  app.use('/api/v1', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
