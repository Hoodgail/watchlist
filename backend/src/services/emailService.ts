import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function requireEmailDelivery(): void {
  if (!process.env.SMTP_URL || !process.env.SMTP_FROM)
    throw new AppError(503, 'Account recovery email is not configured');
}
export async function sendRecoveryEmail(
  to: string,
  token: string,
  purpose: 'verify' | 'reset',
): Promise<void> {
  requireEmailDelivery();
  const transport = nodemailer.createTransport(process.env.SMTP_URL!);
  const link = new URL('/', env.FRONTEND_URL || 'http://localhost:3200');
  link.hash = new URLSearchParams({ verifyRecoveryToken: token }).toString();
  await transport.sendMail({
    from: process.env.SMTP_FROM!,
    to,
    subject:
      purpose === 'verify'
        ? 'Verify your Watchlist recovery email'
        : 'Reset your Watchlist password',
    text:
      purpose === 'verify'
        ? `Verify your Watchlist recovery email: ${link.toString()}\n\nIf you did not request this, ignore this email.`
        : `Your Watchlist password reset code is:\n\n${token}\n\nEnter this code in Watchlist. If you did not request this, ignore this email.`,
  });
}
