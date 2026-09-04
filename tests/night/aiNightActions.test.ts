import { describe, expect, it } from 'vitest';
import { generateAiNightActions } from '@/lib/server/aiNightActions';

const players = [
  { uid: 'human-1', isAlive: true, isAI: false },
  { uid: 'ai-wolf', isAlive: true, isAI: true },
  { uid: 'ai-seer', isAlive: true, isAI: true },
  { uid: 'human-2', isAlive: true, isAI: false },
];

const roles = {
  'human-1': 'Aldeano',
  'ai-wolf': 'Lobo',
  'ai-seer': 'Vidente',
  'human-2': 'Aldeano',
};

describe('generateAiNightActions', () => {
  it('generates actions only for alive AI players', () => {
    const result = generateAiNightActions({ gameId: 'game-1', roundNumber: 1, players, roles });

    expect(Object.keys(result).sort()).toEqual(['ai-seer', 'ai-wolf']);
    expect(result['ai-wolf'][0]?.action).toBe('wolfTarget');
    expect(result['ai-wolf'][0]?.targetUid).toBeTruthy();
    expect(result['ai-seer'][0]?.action).toBe('seerTarget');
    expect(result['ai-seer'][0]?.targetUid).toBeTruthy();
  });

  it('never targets the acting AI', () => {
    const result = generateAiNightActions({ gameId: 'game-2', roundNumber: 2, players, roles });

    for (const [uid, actions] of Object.entries(result)) {
      for (const action of actions) {
        expect(action.targetUid).not.toBe(uid);
        expect(action.targetUids ?? []).not.toContain(uid);
      }
    }
  });

  it('keeps decisions deterministic across retries', () => {
    const input = { gameId: 'same-game', roundNumber: 4, players, roles, criaLoboRage: true };
    expect(generateAiNightActions(input)).toEqual(generateAiNightActions(input));
  });

  it('uses a skip for an AI role without an active night action', () => {
    const result = generateAiNightActions({
      gameId: 'game-3',
      roundNumber: 1,
      players: [{ uid: 'ai-villager', isAlive: true, isAI: true }],
      roles: { 'ai-villager': 'Aldeano' },
    });

    expect(result['ai-villager']).toEqual([{ action: '_skip' }]);
  });

  it('does not generate a wolf kill while wolves are blocked', () => {
    const result = generateAiNightActions({
      gameId: 'blocked-wolves',
      roundNumber: 2,
      players,
      roles,
      lobosBlocked: true,
    });

    expect(result['ai-wolf']).toEqual([{ action: '_skip' }]);
    expect(result['ai-seer'][0]?.action).toBe('seerTarget');
  });
});
