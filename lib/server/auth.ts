import type { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { verifyAuthToken as verifyFirebaseAuthToken } from '@/lib/firebase/verifyAuth';

/** Compatibility server auth adapter for authoritative API routes. */
export async function verifyAuthToken(req: NextRequest | Request): Promise<{ uid: string }> {
  const uid = await verifyFirebaseAuthToken(req as NextRequest);
  if (!uid) throw new Error('UNAUTHORIZED');
  return { uid };
}

/**
 * Authenticates trusted server-to-server invocations (Vercel Cron / external scheduler).
 * CRON_SECRET must never be exposed to the browser.
 */
export function isAuthorizedServerRequest(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = req.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!authorization.startsWith(prefix)) return false;

  const presented = Buffer.from(authorization.slice(prefix.length), 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  if (presented.length !== expected.length) return false;

  return timingSafeEqual(presented, expected);
}
