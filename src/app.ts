import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { IS_PROD } from './core/config.js';
import logger from './core/logger.js';

import { errorMiddleware } from './middlewares/error.js';
import bot from './bot.js';
import { createRouter } from './routes/index.js';

// Environment configuration
const token = process.env.TELEGRAM_BOT_TOKEN;
const PORT = process.env.PORT || 3000;

const BOT_SECRET = process.env.BOT_SECRET;

if (!token) {
  logger.errorWithContext({ message: 'TELEGRAM_BOT_TOKEN is required!' });
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// Trust Vercel proxy to get real client IP
app.set('trust proxy', 1);

app.post('/api', bot.webhookCallback('/api', { secretToken: BOT_SECRET }));

const router = createRouter(bot);
app.use('/api', router);

// Log incoming requests for debugging and monitoring
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.debugWithContext({
    message: `${req.method} ${req.url} (ip: ${req.ip})`,
  });
  next();
});

/**
 * Health check endpoint.
 * Used by monitoring services and to verify the server is running.
 */
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    message: 'Bot webhook server',
    timestamp: new Date().toISOString(),
  });
});

/**
 * 404 handler for undefined routes.
 * Catches all requests that don't match any defined routes.
 * Must be placed after all route definitions but before error middleware.
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
  });
});

app.use(errorMiddleware);

/**
 * Local development server setup and graceful shutdown.
 * Not needed on Vercel (FaaS) where each request is an isolated execution.
 */
if (!IS_PROD) {
  const server = app.listen(PORT, () => {
    logger.infoWithContext({
      message: `Server running on http://localhost:${PORT}`,
    });
    logger.infoWithContext({
      message: 'Webhook endpoint ready at /api',
    });
  });

  /**
   * Performs graceful shutdown of the server and bot
   * @param signal - The signal that triggered the shutdown
   */
  const gracefulShutdown = (signal: string) => {
    logger.infoWithContext({
      message: `${signal} received, shutting down gracefully`,
    });

    server.close(() => {
      logger.infoWithContext({ message: 'Server closed successfully' });
      bot.stop(signal);
      process.exit(0);
    });
  };

  /**
   * Handle termination signals for clean restarts.
   * SIGTERM: Sent by tsx watch when restarting on code changes
   * SIGINT: Sent by Ctrl+C in terminal
   */
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default app;
