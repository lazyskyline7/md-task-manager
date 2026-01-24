import express from 'express';
import type { Telegraf } from 'telegraf';
import { asyncHandler } from '../utils/index.js';
import { verifyCron } from '../middlewares/verifyCron.js';
import { verifyGithubWebhook } from '../middlewares/verifyGithubWebhook.js';
import { healthHandler } from './health.js';
import { cronHandler } from './cron.js';
import { githubWebhookHandler } from './githubWebhook.js';
import { BotContext } from '../middlewares/session.js';

export const createRouter = (bot: Telegraf<BotContext>): express.Router => {
  const router = express.Router();

  router.get('/', healthHandler);

  router.get(
    '/cron',
    verifyCron,
    asyncHandler(async (req, res) => {
      await cronHandler(req, res, bot);
    }),
  );

  router.post(
    '/github-webhook',
    verifyGithubWebhook,
    asyncHandler(async (req, res) => {
      await githubWebhookHandler(req, res, bot);
    }),
  );

  return router;
};
