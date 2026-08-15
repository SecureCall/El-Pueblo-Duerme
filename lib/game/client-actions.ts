import type { User } from 'firebase/auth';

async function postGameAction(user: User, path: string, body: Record<string, unknown>) {
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Error de partida');
  }
  return data;
}

export async function joinGame(user: User, gameId: string, playerName: string) {
  return postGameAction(user, '/api/game/join', { gameId, playerName });
}
