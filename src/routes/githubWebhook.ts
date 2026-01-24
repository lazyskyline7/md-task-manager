import type { Request, Response } from 'express';
import type { Telegraf } from 'telegraf';
import { handleGitHubWebhook } from '../services/githubWebhookHandler.js';
import { BotContext } from '../middlewares/session.js';

export const githubWebhookHandler = async (
  req: Request,
  res: Response,
  bot: Telegraf<BotContext>,
): Promise<void> => {
  await handleGitHubWebhook(req.body, bot as Telegraf<BotContext>);
  res.status(200).json({ success: true });
};
