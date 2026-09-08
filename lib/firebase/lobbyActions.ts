import { auth } from '@/lib/firebase/config';

async function postLobbyAction<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuario no autenticado');

  const idToken = await user.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Error de operación de sala');
  }
  return data as T;
}

export interface LobbyJoinResult {
  ok: true;
  playerCount: number;
}

export interface LobbyMutationResult {
  ok: true;
  playerCount?: number;
  added?: number;
  kickedUid?: string;
  uid?: string;
  lastSeen?: number;
}

export async function requestLobbyJoin(gameId: string, name?: string): Promise<LobbyJoinResult> {
  return postLobbyAction<LobbyJoinResult>('/api/lobby-join', { gameId, ...(name ? { name } : {}) });
}

export async function requestLobbyLeave(gameId: string): Promise<LobbyMutationResult> {
  return postLobbyAction<LobbyMutationResult>('/api/lobby-leave', { gameId });
}

export async function requestLobbyKick(gameId: string, targetUid: string): Promise<LobbyMutationResult> {
  return postLobbyAction<LobbyMutationResult>('/api/lobby-kick', { gameId, targetUid });
}

export async function requestLobbyPresence(gameId: string): Promise<LobbyMutationResult> {
  return postLobbyAction<LobbyMutationResult>('/api/lobby-presence', { gameId });
}

export async function requestLobbyFillBots(gameId: string): Promise<LobbyMutationResult> {
  return postLobbyAction<LobbyMutationResult>('/api/lobby-fill-bots', { gameId });
}

export async function requestGameStart(gameId: string): Promise<Record<string, unknown>> {
  return postLobbyAction<Record<string, unknown>>('/api/game-start', { gameId });
}
