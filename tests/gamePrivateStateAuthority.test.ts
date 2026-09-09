import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'app/api/game-private-state/route.ts'), 'utf8');

describe('game-private-state authority', () => {
  it('authenticates before reading private game state', () => {
    expect(source).toMatch(/verifyAuthToken\(req\)/);
    expect(source).toMatch(/if \(!tokenUid\) return NextResponse\.json\(\{ error: 'No autorizado' \}, \{ status: 401 \}\)/);
  });

  it('reads roles from playerRoles snapshots instead of public game.roles', () => {
    expect(source).toMatch(/collection\('playerRoles'\)\.doc\(player\.uid\)/);
    expect(source).not.toMatch(/game\.roles\?\./);
  });

  it('computes one canonical team value for both active and ended responses', () => {
    expect(source).toMatch(/const myTeam: 'wolves' \| 'village'/);
    expect(source).toMatch(/myTeam,\n      wolfRoster,/);
    expect(source).toMatch(/phase: 'ended', myRole, myTeam, roles, wolfTeam/);
  });

  it('does not expose the complete role map in the active response', () => {
    expect(source).toMatch(/return NextResponse\.json\(\{\n      ok: true,\n      phase: String\(game\.phase \?\? ''\),\n      myRole,\n      myTeam,/);
    expect(source).toMatch(/wolfRoster,\n    \}\);/);
  });

  it('allows the complete role reveal only after the game has ended', () => {
    expect(source).toMatch(/if \(game\.phase === 'ended' \|\| game\.status === 'ended'\)/);
    expect(source).toMatch(/return NextResponse\.json\(\{ ok: true, phase: 'ended', myRole, myTeam, roles, wolfTeam \}\)/);
  });
});
