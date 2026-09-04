'use client';

import { auth } from '@/lib/firebase/config';

/**
 * Sends a player's night action through the authoritative server boundary.
 * The server derives the real role from the authenticated player record;
 * client-provided role data is only an optional consistency hint.
 */
export async function submitNightActionToServer(
  gameId: string,
  payload: Record<string, unknown>,
  role?: string,
): Promise<{ ok: true; duplicate: boolean; roundNumber: number; role: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('AUTH_REQUIRED');

  const idToken = await currentUser.getIdToken();
  const requestId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const response = await fetch('/api/sync-night-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      gameId,
      uid: currentUser.uid,
      ...(role ? { role } : {}),
      payload,
      requestId,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = typeof body?.error === 'string' ? body.error : 'NIGHT_ACTION_FAILED';
    throw new Error(error);
  }

  return body as {
    ok: true;
    duplicate: boolean;
    roundNumber: number;
    role: string;
  };
}
