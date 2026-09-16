import type { BotType } from '@/lib/bots/botSystem';

export type DayAiPlayer = {
  uid: string;
  botType?: BotType | string | null;
  isAI?: boolean;
  isAlive?: boolean;
  voteBanned?: boolean;
  saboteadorBan?: boolean;
};

export type DayAiVoteInput = {
  gameId: string;
  round: number;
  bot: DayAiPlayer;
  alivePlayers: DayAiPlayer[];
  currentVotes: Record<string, string>;
  dayStartedAt?: number | null;
  now?: number;
  sirenaUid?: string | null;
  sirenaLinkedUid?: string | null;
};

export const BOT_DAY_VOTE_WINDOWS: Record<BotType, readonly [number, number]> = {
  callado: [42_000, 54_000],
  acusador: [8_000, 20_000],
  listo: [25_000, 38_000],
  caotico: [3_000, 14_000],
};

function hash32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stablePick<T>(items: T[], seed: string): T | null {
  if (items.length === 0) return null;
  return items[hash32(seed) % items.length] ?? null;
}

function voteCounts(currentVotes: Record<string, string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const target of Object.values(currentVotes)) {
    if (typeof target === 'string') counts[target] = (counts[target] ?? 0) + 1;
  }
  return counts;
}

export function getBotDayVoteDelayMs(gameId: string, round: number, botUid: string, botType: BotType): number {
  const [min, max] = BOT_DAY_VOTE_WINDOWS[botType];
  return min + (hash32(`${gameId}:${round}:${botUid}:day-delay`) % (max - min + 1));
}

export function getServerAiDayVote(input: DayAiVoteInput): string | null {
  const { gameId, round, bot, alivePlayers, currentVotes } = input;
  if (!Number.isInteger(round) || round < 1) return null;
  if (bot.isAI !== true || bot.isAlive !== true || !bot.uid) return null;
  if (bot.voteBanned === true || bot.saboteadorBan === true) return null;

  const botType = bot.botType as BotType | undefined;
  if (!botType || !(botType in BOT_DAY_VOTE_WINDOWS)) return null;

  const now = input.now ?? Date.now();
  if (typeof input.dayStartedAt === 'number' && Number.isFinite(input.dayStartedAt)) {
    const elapsed = now - input.dayStartedAt;
    if (elapsed < getBotDayVoteDelayMs(gameId, round, bot.uid, botType)) return null;
  }

  const candidates = alivePlayers
    .filter(p => p.isAlive === true && p.uid !== bot.uid && p.uid.length > 0)
    .sort((a, b) => a.uid.localeCompare(b.uid));
  if (candidates.length === 0) return null;

  if (input.sirenaLinkedUid === bot.uid && input.sirenaUid) {
    const sirenaTarget = currentVotes[input.sirenaUid];
    if (typeof sirenaTarget === 'string' && candidates.some(p => p.uid === sirenaTarget)) return sirenaTarget;
    return null;
  }

  const counts = voteCounts(currentVotes);
  const leader = () => {
    const max = Math.max(0, ...candidates.map(p => counts[p.uid] ?? 0));
    const leaders = candidates.filter(p => (counts[p.uid] ?? 0) === max);
    return stablePick(leaders, `${gameId}:${round}:${bot.uid}:leader`);
  };

  switch (botType) {
    case 'callado':
    case 'listo':
      return leader()?.uid ?? null;
    case 'acusador': {
      const unvoted = candidates.filter(p => (counts[p.uid] ?? 0) === 0);
      return (stablePick(unvoted.length > 0 ? unvoted : candidates, `${gameId}:${round}:${bot.uid}:accuse`))?.uid ?? null;
    }
    case 'caotico':
      return stablePick(candidates, `${gameId}:${round}:${bot.uid}:chaos`)?.uid ?? null;
    default:
      return null;
  }
}

export function ensureServerAiDayVotes(
  input: Omit<DayAiVoteInput, 'bot'> & { bots: DayAiPlayer[] },
): Record<string, string> {
  const next = { ...input.currentVotes };
  const bots = [...input.bots].sort((a, b) => a.uid.localeCompare(b.uid));

  // Sirena's vote is authoritative for a linked voter. Generate the Sirena first
  // when she is an AI so the result is independent of UID ordering.
  if (input.sirenaUid) {
    const sirena = bots.find(bot => bot.uid === input.sirenaUid);
    if (sirena && !next[sirena.uid]) {
      const target = getServerAiDayVote({ ...input, bot: sirena, currentVotes: next });
      if (target) next[sirena.uid] = target;
    }
  }

  for (const bot of bots) {
    if (next[bot.uid]) continue;
    const target = getServerAiDayVote({ ...input, bot, currentVotes: next });
    if (target) next[bot.uid] = target;
  }
  return next;
}
