/** Deterministic role permutation shared by the authoritative phase-transition routes. */
export function applyRoleSwap(
  roles: Record<string, string>,
  aliveUids: string[],
  gameId: string,
  round: number,
): void {
  if (aliveUids.length < 2) return;
  const orderedUids = [...new Set(aliveUids)].sort();
  const shuffledRoles = orderedUids.map((uid) => roles[uid]);
  if (shuffledRoles.some((role) => typeof role !== 'string' || role.length === 0)) {
    throw new Error('role_swap_snapshot_incomplete');
  }

  let seed = 2166136261;
  const seedText = `${gameId}:roleSwap:${round}`;
  for (let i = 0; i < seedText.length; i++) {
    seed ^= seedText.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const random = () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  for (let i = shuffledRoles.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffledRoles[i], shuffledRoles[j]] = [shuffledRoles[j], shuffledRoles[i]];
  }
  orderedUids.forEach((uid, index) => { roles[uid] = shuffledRoles[index]; });
}
