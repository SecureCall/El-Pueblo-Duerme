import type { NightResolutionInput } from '@/lib/server/nightResolutionInput';

export interface NightDeathEffectsResult {
  initialDeaths: string[];
  cascadeDeaths: string[];
  pendingHunterShot: string | null;
  deathReasons: Record<string, string[]>;
  transformedMalditoUid: string | null;
  nextNightWolfBlock: boolean;
}

/** Pure death-cascade stage. It derives consequences but performs no writes. */
export function resolveNightDeathEffects(
  input: NightResolutionInput,
  initialDeathUids: string[],
  rolesByUid: Record<string, string>,
): NightDeathEffectsResult {
  const alive = new Set(input.players.filter((player) => player.isAlive).map((player) => player.uid));
  const dead = new Set<string>();
  const reasons: Record<string, string[]> = {};
  let transformedMalditoUid: string | null = null;
  let nextNightWolfBlock = false;

  const addDeath = (uid: string, reason: string) => {
    if (!alive.has(uid) || dead.has(uid)) return false;
    dead.add(uid);
    reasons[uid] = [...(reasons[uid] ?? []), reason];
    return true;
  };

  for (const uid of [...new Set(initialDeathUids)]) {
    const role = rolesByUid[uid];

    if (uid === input.history.malditoUid || role === 'Maldito') {
      transformedMalditoUid = uid;
      reasons[uid] = [...(reasons[uid] ?? []), 'maldito_transform'];
      continue;
    }

    if (role === 'Leprosa') {
      nextNightWolfBlock = true;
    }

    addDeath(uid, 'wolf_attack');
  }

  const lovers = input.history.lovers;
  if (lovers) {
    const [first, second] = lovers;
    if (dead.has(first)) addDeath(second, 'lover_cascade');
    if (dead.has(second)) addDeath(first, 'lover_cascade');
  }

  const pendingHunterShot = [...dead].find((uid) => rolesByUid[uid] === 'Cazador') ?? null;

  return {
    initialDeaths: [...dead].filter((uid) => initialDeathUids.includes(uid)),
    cascadeDeaths: [...dead].filter((uid) => !initialDeathUids.includes(uid)),
    pendingHunterShot,
    deathReasons: reasons,
    transformedMalditoUid,
    nextNightWolfBlock,
  };
}
