import type { NextRequest } from 'next/server';
import { verifyAuthToken as verifyFirebaseAuthToken } from '@/lib/firebase/verifyAuth';

/** Compatibility server auth adapter for authoritative API routes. */
export async function verifyAuthToken(req: NextRequest | Request): Promise<{ uid: string }> {
  const uid = await verifyFirebaseAuthToken(req as NextRequest);
  if (!uid) throw new Error('UNAUTHORIZED');
  return { uid };
}
