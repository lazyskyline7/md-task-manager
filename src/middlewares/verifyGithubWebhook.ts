import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from '../core/error.js';
import logger from '../core/logger.js';

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

const verifyGitHubSignature = (
  payload: string,
  signature: string | undefined,
): boolean => {
  if (!GITHUB_WEBHOOK_SECRET) {
    logger.warnWithContext({
      op: 'GITHUB_WEBHOOK',
      message: 'GITHUB_WEBHOOK_SECRET not configured',
    });
    return false;
  }

  if (!signature) {
    return false;
  }

  const expectedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', GITHUB_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  );
};

export const verifyGithubWebhook = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const rawBody = JSON.stringify(req.body);

  if (!verifyGitHubSignature(rawBody, signature)) {
    logger.warnWithContext({
      op: 'GITHUB_WEBHOOK',
      message: 'Invalid webhook signature',
    });
    throw new AppError('Invalid signature', 401);
  }

  const event = req.headers['x-github-event'] as string | undefined;
  if (event !== 'push') {
    throw new AppError(`Unsupported event type: ${event}`, 400);
  }

  next();
};
