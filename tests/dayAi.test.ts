import { describe, expect, it } from 'vitest';
import {
  BOT_DAY_VOTE_WINDOWS,
  ensureServerAiDayVotes,
  getBotDayVoteDelayMs,
  getServerAiDayVote,
  type DayAiPlayer,
} from '@/lib/server/dayAi';

const players: DayAiPlayer[] = [
  { uid: 'bot-callado', isAI: true, isAlive: true, botType: 'callado' },
  { uid: 'bot-acusador', isAI: true, isAlive: true, botType: 'acusador' },
  { uid: 'bot-listo', isAI: true, isAlive: true, botType: 'listo' },
  { uid: 'bot-caotico', isAI: true, isAlive: true, botType: 'caotico' },
  { uid: 'human-a', isAlive: true },
  { uid: 'human-b', isAlive: true },
  { uid: 'dead', isAlive: false },
];

describe('server AI day voting', () => {
  it('keeps the configured bot timing windows', () => {
    for (const [type, [min, max]] of Object.entries(BOT_DAY_VOTE_WINDOWS)) {
      const delay = getBotDayVoteDelayMs('game-1', 2, `bot-${type}`, type as keyof typeof BOT_DAY_VOTE_WINDOWS);
      expect(delay).toBeGreaterThanOrEqual(min);
      expect(delay).toBeLessThanOrEqual(max);
    }
  });

  it('does not vote before its authoritative delay', () => {
    const bot = players[0];
    const delay = getBotDayVoteDelayMs('game-1', 1, bot.uid, 'callado');
    expect(getServerAiDayVote({
      gameId: 'game-1', round: 1, bot, alivePlayers: players,
      currentVotes: {}, dayStartedAt: 1_000, now: 1_000 + delay - 1,
    })).toBeNull();
  });

  it('votes deterministically for every bot type once its window has elapsed', () => {
    for (const bot of players.slice(0, 4)) {
      const delay = getBotDayVoteDelayMs('game-1', 3, bot.uid, bot.botType as keyof typeof BOT_DAY_VOTE_WINDOWS);
      const input = {
        gameId: 'game-1', round: 3, bot, alivePlayers: players,
        currentVotes: { 'human-a': 'human-b' }, dayStartedAt: 10_000, now: 10_000 + delay,
      };
      const first = getServerAiDayVote(input);
      const second = getServerAiDayVote(input);
      expect(first).not.toBeNull();
      expect(first).toBe(second);
      expect(first).not.toBe(bot.uid);
      expect(players.filter(p => p.isAlive).map(p => p.uid)).toContain(first);
    }
  });

  it('makes acusador prefer targets with zero votes', () => {
    const bot = players[1];
    const delay = getBotDayVoteDelayMs('game-2', 1, bot.uid, 'acusador');
    const target = getServerAiDayVote({
      gameId: 'game-2', round: 1, bot, alivePlayers: players,
      currentVotes: { 'human-a': 'human-b', 'bot-callado': 'human-b' },
      dayStartedAt: 0, now: delay,
    });
    expect(['human-a', 'bot-callado', 'bot-acusador', 'dead']).not.toContain(target);
    expect(['human-a', 'bot-callado']).toContain(target);
  });

  it('skips dead or banned bots and never targets dead players', () => {
    const bot = { ...players[0], voteBanned: true };
    expect(getServerAiDayVote({
      gameId: 'game-3', round: 1, bot, alivePlayers: players,
      currentVotes: {}, now: 100_000,
    })).toBeNull();

    const aliveOnly = players.filter(p => p.isAlive);
    const result = ensureServerAiDayVotes({
      gameId: 'game-3', round: 1, bots: players.slice(0, 4), alivePlayers: aliveOnly,
      currentVotes: {}, dayStartedAt: 0, now: 100_000,
    });
    for (const target of Object.values(result)) expect(target).not.toBe('dead');
  });

  it('preserves existing votes and produces stable results across retries', () => {
    const existing = { 'bot-callado': 'human-a' };
    const input = {
      gameId: 'game-4', round: 5, bots: players.slice(0, 4), alivePlayers: players,
      currentVotes: existing, dayStartedAt: 0, now: 100_000,
    };
    const first = ensureServerAiDayVotes(input);
    const second = ensureServerAiDayVotes(input);
    expect(first).toEqual(second);
    expect(first['bot-callado']).toBe('human-a');
    expect(Object.keys(first)).toHaveLength(4);
  });

  it('returns null when there is no legal target', () => {
    const bot: DayAiPlayer = { uid: 'only-bot', isAI: true, isAlive: true, botType: 'caotico' };
    expect(getServerAiDayVote({
      gameId: 'game-5', round: 1, bot, alivePlayers: [bot], currentVotes: {}, now: 100_000,
    })).toBeNull();
  });
});
