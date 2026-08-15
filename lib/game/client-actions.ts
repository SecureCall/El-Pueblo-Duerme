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

export async function updateGamePresence(user: User, gameId: string) {
  return postGameAction(user, '/api/game/presence', { gameId });
}

export async function leaveGame(user: User, gameId: string) {
  return postGameAction(user, '/api/game/leave', { gameId });
}

export async function kickGamePlayer(user: User, gameId: string, targetUid: string) {
  return postGameAction(user, '/api/game/kick', { gameId, targetUid });
}

export async function autofillGame(user: User, gameId: string) {
  return postGameAction(user, '/api/game/autofill', { gameId });
}
