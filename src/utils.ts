// Extract argument from command text
export const extractArg = (text: string, name: string) =>
  text.substring(name.length + 1).trim();

/**
 * Escapes special characters for Telegram MarkdownV2 format
 * Reference: https://core.telegram.org/bots/api#markdownv2-style
 */
const specialChars = /([_*[\]()~`>#+\-=|{}.!\\])/g;
export const escapeMarkdownV2 = (text: string): string =>
  text.replace(specialChars, '\\$1');
