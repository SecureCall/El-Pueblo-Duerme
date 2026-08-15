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
  if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Error de partida');
  return data;
}

export const joinGame = (user: User, gameId: string, playerName: string) => postGameAction(user, '/api/game/join', { gameId, playerName });
export const updateGamePresence = (user: User, gameId: string) => postGameAction(user, '/api/game/presence', { gameId });
export const leaveGame = (user: User, gameId: string) => postGameAction(user, '/api/game/leave', { gameId });
export const kickGamePlayer = (user: User, gameId: string, targetUid: string) => postGameAction(user, '/api/game/kick', { gameId, targetUid });
export const autofillGame = (user: User, gameId: string) => postGameAction(user, '/api/game/autofill', { gameId });
export const startGameServer = (user: User, gameId: string) => postGameAction(user, '/api/game/start', { gameId });
