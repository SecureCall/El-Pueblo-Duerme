import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('role reveal launch flow', () => {
  it('starts a game in role reveal and delegates the night transition to start-night', () => {
    const start = read('app/api/game-start/route.ts');
    const startNight = read('app/api/start-night/route.ts');
    expect(start).toContain("phase: 'roleReveal'");
    expect(start).not.toContain('nightStartedAt: now');
    expect(startNight).toContain("if (game.phase !== 'roleReveal') throw new Error('INVALID_PHASE')");
  });

  it('does not use public role-map existence to decide whether to render role reveal', () => {
    const gamePlay = read('components/game/play/GamePlay.tsx');
    expect(gamePlay).toContain("if (game.phase === 'roleReveal') {");
    expect(gamePlay).not.toContain("if (game.phase === 'roleReveal' || !game.roles)");
  });
});
