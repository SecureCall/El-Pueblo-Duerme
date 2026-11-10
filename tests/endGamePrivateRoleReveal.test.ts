import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const endGame = readFileSync(resolve(process.cwd(), 'components/game/play/EndGame.tsx'), 'utf8');
const gamePlay = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

describe('end-game private role reveal', () => {
  it('receives an explicit game id and requests private reveal for that game', () => {
    expect(endGame).toContain('gameId: string;');
    expect(endGame).toContain('getPrivateGameState(gameId)');
    expect(endGame).not.toContain("getPrivateGameState(game.name ? (game as any).id ?? '' : '')");
    expect(gamePlay).toContain('<EndGame\n        gameId={gameId}');
  });

  it('uses the private ended-game role snapshot for the reveal UI', () => {
    expect(endGame).toContain("!('roles' in state) || !('wolfTeam' in state)");
    expect(endGame).toContain('roles: Object.keys(revealedRoles).length > 0 ? revealedRoles');
    expect(endGame).toContain('wolfTeam: Object.keys(revealedWolfTeam).length > 0 ? revealedWolfTeam');
  });
});
