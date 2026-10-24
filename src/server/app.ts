import express, { Express } from 'express';
import dotenv from 'dotenv';
import { authRouter } from './routes/authRoutes.js';
import { driveRouter } from './routes/driveRoutes.js';
import { profilePhotoRouter } from './routes/profilePhotoRoutes.js';
import { r60ApiRequestMetrics } from './middleware/r60ApiRequestMetrics.js'; // R60-HTTP-METRICS
import { visitorRegistrationRouter } from './routes/visitorRegistrationRoutes.js';

dotenv.config();

export function createApp(): Express {
  const app = express();

  // Configure trusted proxy for Vercel / Cloud Run ingress
  app.set('trust proxy', 1);

  // Body parser for JSON
  app.use(express.json({ limit: '15mb' }));

  // R60-HTTP-METRICS: only coarse error/latency counts. No request bodies.
  app.use(r60ApiRequestMetrics);

  // Mount API routes
  app.use('/api/auth', authRouter);
  app.use('/api/drive', profilePhotoRouter);
  app.use('/api/drive', driveRouter);
  app.use('/api/visitor-registration', visitorRegistrationRouter);

  // R68: audit bundles/backups are not public application assets.
  // Reject before the SPA fallback; keep both Express and Vercel deployments safe.
  app.use('/artifacts', (_req, res) => res.status(404).end());

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
