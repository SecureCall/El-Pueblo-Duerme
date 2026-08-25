import type { NightResolutionInput } from '@/lib/server/nightResolutionInput';

export interface NightDeathEffectsResult {
  initialDeaths: string[];
  cascadeDeaths: string[];
  pendingHunterShot: string | null;
  deathReasons: Record<string, string[]>;
}

/** Pure death-cascade stage. It derives consequences but performs no writes. */
export function resolveNightDeathEffects(
  input: NightResolutionInput,
  initialDeathUids: string[],
): NightDeathEffectsResult {
  const alive = new Set(input.players.filter((player) => player.isAlive).map((player) => player.uid));
  const dead = new Set<string>();
  const reasons: Record<string, string[]> = {};

  const addDeath = (uid: string, reason: string) => {
    if (!alive.has(uid) || dead.has(uid)) return false;
    dead.add(uid);
    reasons[uid] = [...(reasons[uid] ?? []), reason];
    return true;
  };

  for (const uid of [...new Set(initialDeathUids)]) {
    addDeath(uid, 'wolf_attack');
  }

  // Lovers are a symmetric pair. Once one dies, the other dies as a cascade.
  const lovers = input.history.lovers;
  if (lovers) {
    const [first, second] = lovers;
    if (dead.has(first)) addDeath(second, 'lover_cascade');
    if (dead.has(second)) addDeath(first, 'lover_cascade');
  }

  // Cascades are intentionally driven by explicit server state only.
  const pendingHunterShot = null;

  return {
    initialDeaths: [...dead].filter((uid) => initialDeathUids.includes(uid)),
    cascadeDeaths: [...dead].filter((uid) => !initialDeathUids.includes(uid)),
    pendingHunterShot,
    deathReasons: reasons,
  };
}
