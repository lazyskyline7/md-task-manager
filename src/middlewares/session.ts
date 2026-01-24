import { Context, Middleware } from 'telegraf';
import { EditableField } from '../core/types.js';

export interface EditSession {
  taskIdx: number;
  field?: EditableField;
}

export interface SessionData {
  editState?: EditSession;
}

export const sessionMiddleware = (): Middleware<BotContext> => {
  return async (ctx, next) => {
    const key = getSessionKey(ctx);
    if (!key) {
      // Provide an empty session object for updates without chat/from context
      // This prevents runtime errors if accessing ctx.session
      ctx.session = {};
      return next();
    }

    let session = sessions.get(key);
    if (!session) {
      session = {};
      sessions.set(key, session);
    }

    ctx.session = session;
    await next();
  };
};
export interface BotContext extends Context {
  session: SessionData;
}

// In-memory session store
const sessions = new Map<string, SessionData>();

const getSessionKey = (ctx: Context): string | undefined => {
  const fromId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!fromId || !chatId) {
    return undefined;
  }
  return `${fromId}:${chatId}`;
};

// External access for HTTP callbacks
// We assume interactions happen in the user's private chat (chatId = telegramId)
export const setSessionData = (
  telegramId: number,
  data: Partial<SessionData>,
): void => {
  const key = `${telegramId}:${telegramId}`;
  const existing = sessions.get(key) || {};
  sessions.set(key, { ...existing, ...data });
};

// Helper to clear specific session data
export const clearSessionData = (ctx: BotContext): void => {
  const key = getSessionKey(ctx);
  if (key) {
    sessions.delete(key);
  }
};
