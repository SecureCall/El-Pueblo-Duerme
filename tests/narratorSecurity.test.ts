import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/narrator/route.ts'), 'utf8');
const client = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

describe('Narrator security', () => {
  it('requires game identity and authenticated host authority', () => {
    expect(route).toContain('verifyAuthToken(req)');
    expect(route).toContain("typeof body?.gameId === 'string'");
    expect(route).toContain('game.hostUid !== uid');
    expect(route).toContain("game.phase !== 'day'");
  });

  it('derives round, survivors and timing from authoritative game state', () => {
    expect(route).toContain('game.roundNumber');
    expect(route).toContain('game.dayStartedAt');
    expect(route).toContain('game.players');
    expect(route).not.toContain('body.round');
    expect(route).not.toContain('body.survivors');
    expect(route).not.toContain('body.timeElapsedSeconds');
    expect(route).not.toContain('body.silentPlayers');
    expect(route).not.toContain('body.talkingMost');
  });

  it('sends an authenticated minimal request from the client', () => {
    expect(client).toContain('Authorization:');
    expect(client).toContain('body: JSON.stringify({ gameId, event: \'day_interrupt\', interruptType })');
    expect(client).not.toContain('survivors: alivePlayers.map');
    expect(client).not.toContain('silentPlayers,');
    expect(client).not.toContain('talkingMost,');
    expect(client).not.toContain('timeElapsedSeconds: elapsed');
  });
});
