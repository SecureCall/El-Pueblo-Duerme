import type { NightActionSubmission } from '@/lib/game/nightResolution';

export interface NightResolutionPlayer {
  uid: string;
  name?: string;
  isAlive: boolean;
}

export interface NightResolutionSubmission {
  actorUid: string;
  role: string;
  actions: NightActionSubmission[];
}

export interface NightResolutionHistory {
  guardianLastTarget: string | null;
  doctorLastTarget: string | null;
  doctorSelfUsed: boolean;
  brujaProtectedUid: string | null;
  hechiceraLifeUsed: boolean;
  hechiceraPoisonUsed: boolean;
  lovers: [string, string] | null;
  malditoUid: string | null;
  eliminatedHistory: Array<{ uid: string; name: string; role: string; round?: number }>;
  antigoHit: string[];
  cambiaformasTargets: Record<string, string>;
  salvajeMentors: Record<string, string>;
  virginiawoolFate: Record<string, string>;
  perroLoboChoices: Record<string, string>;
  cultMembers: string[];
  vampiroBites: Record<string, number>;
  vampiroKills: number;
  pescadorBoat: string[];
  enchanted: string[];
  hadaLinked: boolean;
  bansheePoints: number;
  vigiaUsed: boolean;
  vigiaKnowsWolves: boolean;
  angelResucitadorUsed: boolean;
  espiaUsed: boolean;
  sirenaUid: string | null;
  sirenaLinked: string | null;
  lobosBlocked: boolean;
  criaLoboRage: boolean;
  wolfTeam: Record<string, boolean>;
}

export interface NightResolutionInput {
  gameId: string;
  roundNumber: number;
  phase: 'night';
  players: NightResolutionPlayer[];
  submissions: NightResolutionSubmission[];
  history: NightResolutionHistory;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readStringRecord(value: unknown): Record<string, string> {
  const source = readRecord(value);
  return Object.fromEntries(
    Object.entries(source).filter(([, item]) => typeof item === 'string'),
  ) as Record<string, string>;
}

function readBooleanRecord(value: unknown): Record<string, boolean> {
  const source = readRecord(value);
  return Object.fromEntries(
    Object.entries(source).filter(([, item]) => item === true),
  ) as Record<string, boolean>;
}

function readNumberRecord(value: unknown): Record<string, number> {
  const source = readRecord(value);
  return Object.fromEntries(
    Object.entries(source).filter(([, item]) => typeof item === 'number' && Number.isFinite(item)),
  ) as Record<string, number>;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function readLovers(game: Record<string, unknown>): [string, string] | null {
  const value = game.lovers;
  if (!Array.isArray(value) || value.length !== 2) return null;
  if (typeof value[0] !== 'string' || typeof value[1] !== 'string') return null;
  if (value[0] === value[1]) return null;
  return [value[0], value[1]];
}

function readHistory(game: Record<string, unknown>): NightResolutionHistory {
  const rawHistory = Array.isArray(game.eliminatedHistory) ? game.eliminatedHistory : [];
  const eliminatedHistory = rawHistory.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.uid !== 'string' || typeof item.name !== 'string' || typeof item.role !== 'string') return [];
    return [{
      uid: item.uid,
      name: item.name,
      role: item.role,
      ...(typeof item.round === 'number' ? { round: item.round } : {}),
    }];
  });

  return {
    guardianLastTarget: typeof game.guardianLastTarget === 'string' ? game.guardianLastTarget : null,
    doctorLastTarget: typeof game.doctorLastTarget === 'string' ? game.doctorLastTarget : null,
    doctorSelfUsed: game.doctorSelfUsed === true,
    brujaProtectedUid: typeof game.brujaProtectedUid === 'string' ? game.brujaProtectedUid : null,
    hechiceraLifeUsed: game.hechiceraLifeUsed === true,
    hechiceraPoisonUsed: game.hechiceraPoisonUsed === true,
    lovers: readLovers(game),
    malditoUid: typeof game.malditoUid === 'string' ? game.malditoUid : null,
    eliminatedHistory,
    antigoHit: readStringArray(game.antiguoHit),
    cambiaformasTargets: readStringRecord(game.cambiaformasTargets),
    salvajeMentors: readStringRecord(game.salvajeMentors),
    virginiawoolFate: readStringRecord(game.virginiawoolFate),
    perroLoboChoices: readStringRecord(game.perroLoboChoices),
    cultMembers: readStringArray(game.cultMembers),
    vampiroBites: readNumberRecord(game.vampiroBites),
    vampiroKills: typeof game.vampiroKills === 'number' ? game.vampiroKills : 0,
    pescadorBoat: readStringArray(game.pescadorBoat),
    enchanted: readStringArray(game.enchanted),
    hadaLinked: game.hadaLinked === true,
    bansheePoints: typeof game.bansheePoints === 'number' ? game.bansheePoints : 0,
    vigiaUsed: game.vigiaUsed === true,
    vigiaKnowsWolves: game.vigiaKnowsWolves === true,
    angelResucitadorUsed: game.angelResucitadorUsed === true,
    espiaUsed: game.espiaUsed === true,
    sirenaUid: typeof game.sirenaUid === 'string' ? game.sirenaUid : null,
    sirenaLinked: typeof game.sirenaLinked === 'string' ? game.sirenaLinked : null,
    lobosBlocked: game.lobosBlocked === true,
    criaLoboRage: game.criaLoboRage === true,
    wolfTeam: readBooleanRecord(game.wolfTeam),
  };
}

/** Builds the server-owned input from persisted submissions and game history. */
export function createNightResolutionInput(
  gameId: string,
  roundNumber: number,
  players: Array<Record<string, unknown>>,
  submissions: NightResolutionSubmission[],
  game: Record<string, unknown>,
): NightResolutionInput {
  return {
    gameId,
    roundNumber,
    phase: 'night',
    players: players
      .filter((player) => typeof player.uid === 'string')
      .map((player) => ({
        uid: player.uid as string,
        ...(typeof player.name === 'string' ? { name: player.name } : {}),
        isAlive: player.isAlive === true,
      })),
    submissions,
    history: readHistory(game),
  };
}
