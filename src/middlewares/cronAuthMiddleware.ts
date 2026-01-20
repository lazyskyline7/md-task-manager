import { Request, Response, NextFunction } from 'express';
import { AppError } from '../core/error.js';

// Security middleware for cron endpoint
export const cronAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    throw new AppError('Unauthorized', 401);
  }
  next();
};
