import type { DayResolutionInput } from '@/lib/server/dayResolutionEngine';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.length > 0) : [];
}
function stringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(record(value)).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
}
function boolRecord(value: unknown): Record<string, boolean> {
  return Object.fromEntries(Object.entries(record(value)).filter(([, v]) => v === true)) as Record<string, boolean>;
}
function readLovers(value: unknown): [string, string] | null {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string' || value[0] === value[1]) return null;
  return [value[0], value[1]];
}

export function createDayResolutionInput(gameId: string, game: Record<string, unknown>, roles: Record<string, string>, votes: Record<string, string>, now: number): DayResolutionInput {
  const rawPlayers = Array.isArray(game.players) ? game.players : [];
  const players = rawPlayers.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const p = raw as Record<string, unknown>;
    if (typeof p.uid !== 'string') return [];
    return [{ ...p, uid: p.uid, isAlive: p.isAlive === true, ...(typeof p.name === 'string' ? { name: p.name } : {}) }];
  });
  const rawHistory = Array.isArray(game.eliminatedHistory) ? game.eliminatedHistory : [];
  const eliminatedHistory = rawHistory.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const h = raw as Record<string, unknown>;
    if (typeof h.uid !== 'string' || typeof h.name !== 'string' || typeof h.role !== 'string') return [];
    return [{ uid: h.uid, name: h.name, role: h.role, ...(typeof h.round === 'number' ? { round: h.round } : {}) }];
  });
  return {
    gameId,
    roundNumber: Number.isInteger(game.roundNumber) ? Number(game.roundNumber) : 1,
    now,
    players,
    votes,
    roles,
    wolfTeam: boolRecord(game.wolfTeam),
    eliminatedHistory,
    enchanted: strings(game.enchanted),
    salvajeMentors: stringRecord(game.salvajeMentors),
    cambiaformasTargets: stringRecord(game.cambiaformasTargets),
    verdugos: stringRecord(game.verdugos),
    virginiawoolFate: stringRecord(game.virginiawoolFate),
    lovers: readLovers(game.lovers),
    cultMembers: strings(game.cultMembers),
    perroLoboChoices: stringRecord(game.perroLoboChoices) as Record<string, 'wolves' | 'village'>,
    vampiroKills: typeof game.vampiroKills === 'number' && Number.isFinite(game.vampiroKills) ? game.vampiroKills : 0,
    pescadorBoat: strings(game.pescadorBoat),
    hadaLinked: game.hadaLinked === true,
    fantasmaPending: strings(game.fantasmaPending),
    fantasmaUsed: strings(game.fantasmaUsed),
    bansheePoints: typeof game.bansheePoints === 'number' && Number.isFinite(game.bansheePoints) ? game.bansheePoints : 0,
    bansheePredictionUid: typeof game.bansheePredictionUid === 'string' ? game.bansheePredictionUid : null,
    voteBanned: strings(game.voteBanned),
    saboteadorBan: typeof game.saboteadorBan === 'string' ? game.saboteadorBan : null,
    cursed: game.cursed && typeof game.cursed === 'object' && !Array.isArray(game.cursed)
      && typeof (game.cursed as Record<string, unknown>).uid === 'string'
      && typeof (game.cursed as Record<string, unknown>).round === 'number'
      ? { uid: (game.cursed as Record<string, unknown>).uid as string, round: (game.cursed as Record<string, unknown>).round as number }
      : null,
    currentEvent: game.currentEvent && typeof game.currentEvent === 'object' && !Array.isArray(game.currentEvent)
      ? { mechanical: typeof (game.currentEvent as Record<string, unknown>).mechanical === 'string' ? (game.currentEvent as Record<string, unknown>).mechanical as string : undefined }
      : null,
    noExileActive: game.noExileActive === true,
    principeUsed: game.principeUsed === true,
    alborotadoraFight: Array.isArray(game.alborotadoraFight) && game.alborotadoraFight.length === 2
      && typeof game.alborotadoraFight[0] === 'string' && typeof game.alborotadoraFight[1] === 'string'
      ? [game.alborotadoraFight[0], game.alborotadoraFight[1]]
      : null,
    sirenaLinked: typeof game.sirenaLinked === 'string' ? game.sirenaLinked : null,
  };
}
