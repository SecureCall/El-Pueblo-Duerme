import type { User } from 'firebase/auth';

async function postSpecialAction(user: User, path: string, body: Record<string, string>): Promise<void> {
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data?.error === 'string' ? data.error : `SPECIAL_ACTION_FAILED:${response.status}`);
  }
}

/** Submit the Cazador's authoritative post-death shot. */
export function requestCazadorShot(user: User, gameId: string, targetUid: string): Promise<void> {
  return postSpecialAction(user, '/api/cazador-shot', { gameId, targetUid });
}

/** Submit the Chivo Expiatorio's authoritative vote-ban choice. */
export function requestChivoChoice(user: User, gameId: string, targetUid: string): Promise<void> {
  return postSpecialAction(user, '/api/chivo-choice', { gameId, targetUid });
}
