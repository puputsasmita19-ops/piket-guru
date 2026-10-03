import express, { Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { authRouter } from './routes/authRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(): Express {
  const app = express();

  // Configure trusted proxy for Vercel / Cloud Run ingress
  app.set('trust proxy', 1);

  // Body parser for JSON
  app.use(express.json({ limit: '15mb' }));

  // Request logger for API calls (sanitized: never log pin/passwords)
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      const sanitizedBody = { ...req.body };
      if (sanitizedBody.pin) sanitizedBody.pin = '[REDACTED]';
      if (sanitizedBody.oldPin) sanitizedBody.oldPin = '[REDACTED]';
      if (sanitizedBody.newPin) sanitizedBody.newPin = '[REDACTED]';
      console.log(`[API] ${req.method} ${req.path}`, Object.keys(sanitizedBody).length ? sanitizedBody : '');
    }
    next();
  });

  // Mount API routes
  app.use('/api/auth', authRouter);

  // Serve audit artifacts explicitly
  app.use('/artifacts', express.static(path.resolve(__dirname, '../../public/artifacts')));
  app.use('/artifacts', express.static(path.resolve(__dirname, '../../artifacts')));

  // Health check endpoint with rate limiter readiness check (R11-01)
  app.get('/api/health', async (req, res) => {
    const { getAuthRateLimiterReadiness } = await import('./middleware/rateLimiter.js');
    const authReadiness = await getAuthRateLimiterReadiness();
    const isOk = authReadiness.status === 'HEALTHY';

    res.status(isOk ? 200 : 503).json({
      status: isOk ? 'OK' : 'UNAVAILABLE',
      app: 'Piket Guru Digital',
      version: '1.1.0',
      timestamp: new Date().toISOString(),
      authRateLimiter: {
        status: authReadiness.status,
        driver: authReadiness.driver,
      },
    });
  });

  // Explicit 404 handler for unhandled API routes to prevent falling through to HTML SPA
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({
        success: false,
        error: `Rute API ${req.method} ${req.originalUrl} tidak ditemukan.`,
        code: 'NOT_FOUND',
      });
      return;
    }
    next();
  });

  return app;
}

export const app: Express = createApp();
