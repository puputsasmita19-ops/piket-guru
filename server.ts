import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { authRouter } from './src/server/routes/authRoutes';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Configure trusted proxy for standard single-hop Cloud Run / reverse proxy ingress
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

  // Serve audit artifacts explicitly in all environments
  app.use('/artifacts', express.static(path.resolve(__dirname, 'public/artifacts')));
  app.use('/artifacts', express.static(path.resolve(__dirname, 'artifacts')));

  // Health check endpoint with rate limiter readiness check (R11-01)
  app.get('/api/health', async (req, res) => {
    const { getAuthRateLimiterReadiness } = await import('./src/server/middleware/rateLimiter');
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

  if (!isProd) {
    // Development mode: mount Vite dev server as middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: serve built assets from dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Piket Guru v1.0.1 running on port ${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
