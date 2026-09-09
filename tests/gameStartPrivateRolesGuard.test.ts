import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'app/api/game-start/route.ts'),
  'utf8',
);

describe('game-start private role guard', () => {
  it('persists assigned roles only in private playerRoles snapshots', () => {
    expect(source).toContain("gameRef.collection('playerRoles').doc(player.uid)");
    expect(source).toContain('const role = assigned[player.uid] ?? \'Aldeano\';');
  });

  it('never publishes the assigned role map or wolf team on games/{gameId}', () => {
    expect(source).toContain('Roles and wolf-team membership are secret');
    expect(source).not.toMatch(/tx\.update\(gameRef, \{[\s\S]{0,1200}\bwolfTeam\s*:/);
    expect(source).not.toMatch(/tx\.update\(gameRef, \{[\s\S]{0,1200}\broles\s*:/);
  });

  it('does not embed a private role in the public player snapshot', () => {
    expect(source).toContain('role: null');
    expect(source).not.toMatch(/role:\s*assigned\[p\.uid\]/);
  });
});
