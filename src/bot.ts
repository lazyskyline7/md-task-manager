import dns from 'dns';
import https from 'https';
import { Composer, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { Command, IS_PROD } from './core/config.js';
import logger from './core/logger.js';
import { addCommand } from './commands/add.js';
import { completeCommand } from './commands/complete.js';
import { removeCommand } from './commands/remove.js';
import { listCommand } from './commands/list.js';
import { clearCompletedCommand } from './commands/clearCompleted.js';
import {
  setTimezoneCommand,
  listTimezonesCommand,
  myTimezoneCommand,
} from './commands/timezone.js';
import { editCommand } from './commands/edit.js';
import { sortCommand } from './commands/sort.js';
import { registerSortAction } from './actions/sort.js';
import { todayCommand } from './commands/today.js';
import { aboutCommand } from './commands/about.js';
import { START_WORDING } from './views/generalView.js';
import { sessionMiddleware, BotContext } from './middlewares/session.js';
import { whitelist } from './middlewares/whitelist.js';
import { editTaskScene } from './scenes/editTaskScene.js';
import { registerCalendarAction } from './actions/calendar.js';
import { Scenes } from 'telegraf';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  logger.errorWithContext({ message: 'TELEGRAM_BOT_TOKEN is required!' });
  process.exit(1);
}

if (!IS_PROD) {
  dns.setDefaultResultOrder('ipv4first');
}

const bot = new Telegraf<BotContext>(token, {
  telegram: {
    agent: !IS_PROD
      ? new https.Agent({ family: 4, keepAlive: true })
      : undefined,
  },
});

bot.use(sessionMiddleware());

bot.catch((err) => {
  logger.errorWithContext({
    op: 'TELEGRAF',
    error: err instanceof Error ? err.message : err,
  });
});

const infoComposer = new Composer();
infoComposer.command(Command.ABOUT, aboutCommand);

export const opComposer = new Composer<BotContext>();

const stage = new Scenes.Stage<BotContext>([editTaskScene]);

opComposer.use(stage.middleware());
opComposer.use(whitelist);

opComposer.command(Command.ADD, addCommand);
opComposer.command(Command.LIST, listCommand);
opComposer.command(Command.COMPLETE, completeCommand);
opComposer.command(Command.EDIT, editCommand);
opComposer.command(Command.REMOVE, removeCommand);
opComposer.command(Command.CLEARCOMPLETED, clearCompletedCommand);
opComposer.command(Command.SETTIMEZONE, setTimezoneCommand);
opComposer.command(Command.LISTTIMEZONES, listTimezonesCommand);
opComposer.command(Command.MYTIMEZONE, myTimezoneCommand);
opComposer.command(Command.TODAY, todayCommand);
opComposer.command(Command.SORT, sortCommand);

bot.use(infoComposer, opComposer);

registerSortAction(bot);
registerCalendarAction(bot);

bot.on(message('text'), (ctx) => {
  ctx.reply(START_WORDING, { parse_mode: 'MarkdownV2' }).catch((error) => {
    logger.errorWithContext({
      userId: ctx.from?.id,
      op: 'BOT_REPLY',
      error,
    });
  });
});

logger.debugWithContext({ message: START_WORDING });

export default bot;
