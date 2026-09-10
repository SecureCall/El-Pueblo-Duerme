import { getAuth } from 'firebase/auth';

export type NightStatus = {
  ok: true;
  phase: string | null;
  roundNumber: number | null;
  submitted: boolean;
  submittedCount: number;
  aliveCount: number;
  phaseEndsAt: number | null;
  resolving: boolean;
};

export async function getNightStatus(gameId: string): Promise<NightStatus> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Usuario no autenticado');
  const token = await user.getIdToken();
  const response = await fetch(`/api/night-status?gameId=${encodeURIComponent(gameId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'No se pudo obtener el estado de la noche');
  return data as NightStatus;
}
