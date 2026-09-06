export interface RoleSnapshotPlayer {
  uid: string;
  isAI?: boolean;
}

export interface RoleSnapshotValidationInput {
  players: RoleSnapshotPlayer[];
  publicRoles: Record<string, unknown>;
  privateRoles: Record<string, unknown>;
}

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
