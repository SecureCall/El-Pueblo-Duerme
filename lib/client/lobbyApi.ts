import type { User } from 'firebase/auth';

async function authHeaders(user: User): Promise<HeadersInit> {
  const token = await user.getIdToken();
  if (!token) throw new Error('No autenticado');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function postLobbyAction(user: User, path: string, gameId: string) {
  const response = await fetch(path, {
    method: 'POST',
    headers: await authHeaders(user),
    body: JSON.stringify({ gameId }),
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body?.error === 'string' ? body.error : `Error ${response.status}`);
  }
  return response.json();
}

export function joinLobby(user: User, gameId: string) {
  return postLobbyAction(user, '/api/lobby-join', gameId);
}

export function fillLobbyWithBots(user: User, gameId: string) {
  return postLobbyAction(user, '/api/lobby-fill-bots', gameId);
}
