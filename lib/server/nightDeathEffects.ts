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

  // De-duplicate simultaneous attacks before applying any future cascades.
  for (const uid of [...new Set(initialDeathUids)]) {
    addDeath(uid, 'wolf_attack');
  }

  // Cascades are intentionally driven by explicit server actions/state only.
  // This stage currently establishes the deterministic boundary for future
  // lover/twin/hunter effects without guessing role-specific legacy rules.
  const pendingHunterShot = null;

  return {
    initialDeaths: [...dead].filter((uid) => initialDeathUids.includes(uid)),
    cascadeDeaths: [...dead].filter((uid) => !initialDeathUids.includes(uid)),
    pendingHunterShot,
    deathReasons: reasons,
  };
}
