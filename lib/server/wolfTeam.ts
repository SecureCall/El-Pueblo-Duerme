const WOLF_ROLES = new Set(['Lobo', 'Lobo Blanco', 'Cría de Lobo']);

/**
 * Canonicalizes the persisted wolf-team map from the authoritative role map.
 * Stale/invalid entries must never grant access to wolf-only channels.
 */
export function canonicalizeWolfTeam(
  roles: Record<string, string>,
  candidate: Record<string, boolean> = {},
): Record<string, boolean> {
  const wolfTeam: Record<string, boolean> = {};

  for (const [uid, role] of Object.entries(roles)) {
    if (WOLF_ROLES.has(role)) wolfTeam[uid] = true;
  }

  // Preserve only candidate members whose current authoritative role is also a wolf role.
  for (const [uid, isMember] of Object.entries(candidate)) {
    if (isMember === true && WOLF_ROLES.has(roles[uid])) wolfTeam[uid] = true;
  }

  return wolfTeam;
}
