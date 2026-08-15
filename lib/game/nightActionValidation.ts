export type NightValidationPlayer = {
  uid: string;
  isAlive: boolean;
};

export type NightValidationContext = {
  phase: string;
  round: number;
  actor: NightValidationPlayer;
  targetIds: string[];
  players: NightValidationPlayer[];
  allowSelfTarget?: boolean;
  maxTargets?: number;
};

export type NightValidationResult =
  | { ok: true }
  | { ok: false; code: 'INVALID_PHASE' | 'ACTOR_DEAD' | 'TARGET_NOT_FOUND' | 'TARGET_DEAD' | 'SELF_TARGET' | 'TOO_MANY_TARGETS' | 'DUPLICATE_TARGET' };

export function validateNightAction(ctx: NightValidationContext): NightValidationResult {
  if (ctx.phase !== 'night') return { ok: false, code: 'INVALID_PHASE' };
  if (!ctx.actor.isAlive) return { ok: false, code: 'ACTOR_DEAD' };
  if (ctx.maxTargets !== undefined && ctx.targetIds.length > ctx.maxTargets) {
    return { ok: false, code: 'TOO_MANY_TARGETS' };
  }
  if (new Set(ctx.targetIds).size !== ctx.targetIds.length) {
    return { ok: false, code: 'DUPLICATE_TARGET' };
  }

  const players = new Map(ctx.players.map((p) => [p.uid, p]));
  for (const targetId of ctx.targetIds) {
    const target = players.get(targetId);
    if (!target) return { ok: false, code: 'TARGET_NOT_FOUND' };
    if (!target.isAlive) return { ok: false, code: 'TARGET_DEAD' };
    if (!ctx.allowSelfTarget && targetId === ctx.actor.uid) {
      return { ok: false, code: 'SELF_TARGET' };
    }
  }
  return { ok: true };
}
