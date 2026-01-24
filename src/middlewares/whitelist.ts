import type { Middleware } from 'telegraf';
import { ALLOWED_USERS } from '../core/config.js';
import logger from '../core/logger.js';
import { BotContext } from './session.js';

/**
 * Whitelist middleware for bot commands.
 * Enforces whitelist-based access control.
 */
export const whitelist: Middleware<BotContext> = async (ctx, next) => {
  try {
    const userId = ctx.from?.id;

    if (!userId || !ALLOWED_USERS.includes(userId)) {
      logger.warnWithContext({
        userId,
        message: 'Unauthorized access attempt',
      });

      const contactInfo =
        ALLOWED_USERS.length > 0
          ? `Please contact the [administrator](tg://user?id=${ALLOWED_USERS[0]}) to gain access\\.`
          : 'Please configure `TELEGRAM_BOT_WHITELIST` in your environment variables\\.';

      await ctx.reply(
        `*Access Restricted* \\- This bot is private\\. ${contactInfo}`,
        {
          parse_mode: 'MarkdownV2',
        },
      );
      return;
    }
    await next();
  } catch (error) {
    logger.errorWithContext({
      message: 'Security middleware error',
      error: error instanceof Error ? error.message : error,
    });
  }
};
