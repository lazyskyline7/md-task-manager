import { Context } from 'telegraf';
import logger from '../logger.js';
import { Command } from '../config.js';

const REPO_URL = 'https://github.com/lazyskyline7/md-task-manager';
const VERSION = '1\\.0\\.0';

export const aboutCommand = async (ctx: Context) => {
  try {
    const message = `
🤖 *Markdown Task Manager Bot*

*Version:* ${VERSION}

A smart Telegram bot that manages your tasks in a Markdown file using AI\\. It parses natural language to extract task details, syncs with Google Calendar, and keeps everything organized\\.

*Repository:* [github\\.com/lazyskyline7/md\\-task\\-manager](${REPO_URL})

*Features:*
• AI\\-powered task parsing with Gemini
• Google Calendar sync
• Markdown storage on GitHub
• Timezone\\-aware scheduling
• Natural language processing

*Commands:* Use /start to see available commands

*Report Issues:* [GitHub Issues](${REPO_URL}/issues)
*Contribute:* [Pull Requests Welcome](${REPO_URL}/pulls)
    `.trim();

    await ctx.replyWithMarkdownV2(message);
  } catch (error) {
    logger.errorWithContext({
      userId: ctx.from?.id,
      op: Command.ABOUT,
      error,
    });
    ctx.reply('❌ Error showing bot information');
  }
};
