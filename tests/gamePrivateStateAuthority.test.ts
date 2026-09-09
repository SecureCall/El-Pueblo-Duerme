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

  it('does not return the complete role map while the game is active', () => {
    const activeSection = source.split("if (game.phase === 'ended' || game.status === 'ended')")[1]?.split("return NextResponse.json({")[1] ?? '';
    expect(activeSection).not.toMatch(/roles\s*:/);
  });

  it('allows the complete role reveal only after the game has ended', () => {
    expect(source).toMatch(/if \(game\.phase === 'ended' \|\| game\.status === 'ended'\)/);
    expect(source).toMatch(/return NextResponse\.json\(\{ ok: true, phase: 'ended', myRole, roles, wolfTeam \}\)/);
  });
});
