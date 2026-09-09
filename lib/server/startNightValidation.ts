export interface RoleSnapshotPlayer {
  uid: string;
  isAI?: boolean;
}

export interface RoleSnapshotValidationInput {
  players: RoleSnapshotPlayer[];
  publicRoles: Record<string, unknown>;
  privateRoles: Record<string, unknown>;
}

/**
 * Legacy migration validator: verifies that an existing public role map and
 * the private canonical snapshots agree. Kept for migration tests/diagnostics.
 */
export function validateRoleSnapshot({ players, publicRoles, privateRoles }: RoleSnapshotValidationInput): boolean {
  if (!Array.isArray(players) || players.length === 0) return false;
  if (!publicRoles || typeof publicRoles !== 'object' || Array.isArray(publicRoles)) return false;
  if (!privateRoles || typeof privateRoles !== 'object' || Array.isArray(privateRoles)) return false;

  const playerUids = new Set(players.map((player) => player.uid).filter(Boolean));
  if (playerUids.size !== players.length) return false;

  for (const uid of playerUids) {
    const publicRole = publicRoles[uid];
    const privateRole = privateRoles[uid];
    if (typeof publicRole !== 'string' || publicRole.length === 0) return false;
    if (typeof privateRole !== 'string' || privateRole.length === 0) return false;
    if (publicRole !== privateRole) return false;
  }

  return Object.keys(privateRoles).length === playerUids.size;
}

/**
 * Authoritative validator for starting the night. It deliberately does not
 * require or inspect the public game.roles map because roles are secret.
 */
export function validatePrivateRoleSnapshot({
  players,
  privateRoles,
}: {
  players: RoleSnapshotPlayer[];
  privateRoles: Record<string, unknown>;
}): boolean {
  if (!Array.isArray(players) || players.length === 0) return false;
  if (!privateRoles || typeof privateRoles !== 'object' || Array.isArray(privateRoles)) return false;

  const playerUids = new Set(players.map((player) => player.uid).filter(Boolean));
  if (playerUids.size !== players.length) return false;
  if (Object.keys(privateRoles).length !== playerUids.size) return false;

  for (const uid of playerUids) {
    const role = privateRoles[uid];
    if (typeof role !== 'string' || role.length === 0) return false;
  }

  return true;
}
