/** R60: privacy-first HTTP diagnostics for server logs (no user data or URLs). */
import type { Request, Response, NextFunction } from 'express';

// Limit expensive log bursts per runtime instance. Vercel may run many instances;
// this cap reduces spam but is not a distributed rate limiter or alert system.
let logWindowStartedAt = 0;
let logCountInWindow = 0;

/** Buckets are static labels. Dynamic IDs, paths, query strings and bodies are never logged. */
export function r60RouteGroup(pathname: string): string {
  if (pathname === '/api/health') return 'health';
  if (pathname.startsWith('/api/auth/')) return 'auth';
  if (pathname.startsWith('/api/drive/')) return 'drive';
  if (pathname.startsWith('/api/')) return 'other_api';
  return 'not_api';
}

export function r60DurationBucket(milliseconds: number): string {
  return milliseconds < 300 ? 'lt300ms' : milliseconds < 1000 ? '300-999ms'
    : milliseconds < 3000 ? '1-3s' : milliseconds < 10000 ? '3-10s' : 'gte10s';
}

/** Log failures and unexpectedly slow responses, never normal personal requests. */
export function r60ApiRequestMetrics(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api/')) { next(); return; }
  const group = r60RouteGroup(req.path);
  const start = process.hrtime.bigint();
  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    if (status < 500 && status !== 429 && durationMs < 3000) return;
    const now = Date.now();
    if (now - logWindowStartedAt >= 60_000) {
      logWindowStartedAt = now;
      logCountInWindow = 0;
    }
    if (logCountInWindow >= 60) return;
    logCountInWindow++;
    // Labels only: no URL, body, stack, client IP, auth headers or identifiers.
    const event = {
      schema: 'R60_HTTP_V1',
      group,
      statusClass: `${Math.floor(status / 100)}xx`,
      rateLimited: status === 429,
      duration: r60DurationBucket(durationMs),
    };
    console.warn('[R60_HTTP]', JSON.stringify(event));
  });
  next();
}
