export const extractArg = (text: string, name: string) =>
  text.substring(name.length + 1).trim();
