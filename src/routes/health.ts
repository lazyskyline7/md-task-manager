import type { Request, Response } from 'express';

export const healthHandler = (_req: Request, res: Response): void => {
  res.json({
    status: 'ok',
    message: 'Bot webhook server',
    timestamp: new Date().toISOString(),
  });
};
