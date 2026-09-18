/**
 * Express Server Entry Point
 * Security-first architecture: all middleware applied before routes.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { initializeDatabase, seedDatabase } from './db/schema.js';
import { validateSecurityConfig, SECURITY_CONFIG } from './config/security.js';
import { createSessionMiddleware } from './services/session.service.js';
import { securityHeaders, corsMiddleware, requestId, errorHandler, noCacheHeaders, requireJsonContentType } from './middleware/security.js';
import { globalRateLimiter } from './middleware/rateLimiter.js';
import { requireAuth } from './middleware/auth.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import clientRoutes from './routes/client.routes.js';
import projectRoutes from './routes/project.routes.js';
import sowRoutes from './routes/sow.routes.js';
import fxRoutes from './routes/fx.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import managerRoutes from './routes/manager.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import reportRoutes from './routes/report.routes.js';
import auditRoutes from './routes/audit.routes.js';

async function main() {
  // ── 1. Validate security configuration ────────────────────
  validateSecurityConfig();

  // ── 2. Initialize database ────────────────────────────────
  initializeDatabase();
  await seedDatabase();

  // ── 3. Create Express app ─────────────────────────────────
  const app = express();

  // Trust first proxy (for correct IP in rate limiting / audit)
  app.set('trust proxy', 1);

  // ── 4. Global security middleware (applied BEFORE routes) ──
  app.use(requestId);
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(noCacheHeaders);
  app.use(globalRateLimiter);

  // ── 5. Session middleware ─────────────────────────────────
  app.use(createSessionMiddleware());

  // ── 6. Content-Type validation for mutations ──────────────
  app.use('/api', requireJsonContentType);

  // ── 7. API Routes ─────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/fx', fxRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/sows', sowRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/managers', managerRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/audit', auditRoutes);

  // ── 8. Health check (unauthenticated) ─────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── 9. Serve frontend in production ───────────────────────
  if (SECURITY_CONFIG.server.isProduction) {
    const distPath = path.resolve(__dirname, '..', 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // ── 10. Global error handler (LAST middleware) ─────────────
  app.use(errorHandler);

  // ── 11. Start server ──────────────────────────────────────
  const port = SECURITY_CONFIG.server.port;
  app.listen(port, '0.0.0.0', () => {
    console.log(`\n🔒 IQA Finance Portal — Security-First Backend`);
    console.log(`   Server running on http://0.0.0.0:${port}`);
    console.log(`   Environment: ${SECURITY_CONFIG.server.isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`   Session idle timeout: ${SECURITY_CONFIG.session.idleTimeoutMs / 60000} min`);
    console.log(`   Session absolute lifetime: ${SECURITY_CONFIG.session.absoluteLifetimeMs / 3600000} hr`);
    console.log(`   Login rate limit: ${SECURITY_CONFIG.rateLimit.authMax} attempts / ${SECURITY_CONFIG.rateLimit.authWindowMs / 60000} min`);
    console.log(`   Account lockout after: ${SECURITY_CONFIG.login.maxAttempts} failed attempts`);
    console.log(`   Password min length: ${SECURITY_CONFIG.password.minLength} characters`);
    console.log('');
  });
}

main().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
