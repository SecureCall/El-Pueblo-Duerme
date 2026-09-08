import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('lobby kick authority', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'app/api/game-lobby-kick/route.ts'),
    'utf8',
  );

  it('requires authentication and makes the host decision server-side', () => {
    expect(source).toContain('verifyAuthToken');
    expect(source).toContain("game.hostUid !== uid");
    expect(source).toContain('db.runTransaction');
  });

  it('only permits kicks while the game is still in the lobby', () => {
    expect(source).toContain("game.status !== 'lobby' || game.phase !== 'lobby'");
  });

  it('rebuilds players and playerCount atomically instead of using client arrayRemove', () => {
    expect(source).toContain('const nextPlayers = players.filter');
    expect(source).toContain('playerCount: nextPlayers.length');
    expect(source).not.toContain('arrayRemove');
  });
});
