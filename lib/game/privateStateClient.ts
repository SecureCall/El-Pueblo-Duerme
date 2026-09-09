import { getAuth } from 'firebase/auth';

export type PrivateGameStateBase = {
  ok: true;
  phase: string;
  myRole: string | null;
  myTeam: 'wolves' | 'village';
  wolfRoster: Array<{ uid: string; name: string }>;
};

export type PrivateGameState =
  | (PrivateGameStateBase & {
      phase: 'ended';
      roles: Record<string, string>;
      wolfTeam: Record<string, boolean>;
    })
  | PrivateGameStateBase;

export async function getPrivateGameState(gameId: string): Promise<PrivateGameState> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Usuario no autenticado');
  const token = await user.getIdToken();
  const response = await fetch(`/api/game-private-state?gameId=${encodeURIComponent(gameId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'No se pudo obtener el estado privado');
  return data as PrivateGameState;
}
