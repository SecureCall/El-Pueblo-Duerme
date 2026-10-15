import { describe, expect, it } from 'vitest';
import { buildServerAINightPayload } from '@/lib/server/aiNight';

describe('server AI Hechicera night actions', () => {
  const players = [
    { uid: 'witch', isAlive: true, isAI: true },
    { uid: 'p1', isAlive: true, isAI: false },
    { uid: 'p2', isAlive: true, isAI: false },
  ];

  it('submits the life potion while it is unused', () => {
    const payload = buildServerAINightPayload('Hechicera', 'witch', 2, players, {
      hechiceraLifeUsed: false,
      hechiceraPoisonUsed: true,
    });

    expect(payload._skip).not.toBe(true);
    expect(payload.witchSave).toBe(true);
  });

  it('does not submit a used life potion', () => {
    const payload = buildServerAINightPayload('Hechicera', 'witch', 2, players, {
      hechiceraLifeUsed: true,
      hechiceraPoisonUsed: true,
    });

    expect(payload).toEqual({ _skip: true });
  });

  it('may submit the poison only while the poison potion is unused and targets a living player', () => {
    const payload = buildServerAINightPayload('Hechicera', 'witch', 2, players, {
      hechiceraLifeUsed: true,
      hechiceraPoisonUsed: false,
    });

    if (payload.witchPoison !== undefined) {
      expect(['p1', 'p2']).toContain(payload.witchPoison);
    }
  });
});
