import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/reset-game/route.ts'), 'utf8');
const gamePlay = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

describe('rematch reset authority', () => {
  it('authenticates the caller and allows reset only after the game ended', () => {
    expect(route).toContain('verifyAuthToken(request)');
    expect(route).toContain("game.phase !== 'ended'");
    expect(route).toContain("hostStillHere && game.hostUid !== user.uid");
    expect(route).toContain("!hostStillHere && !callerIsPlayer");
    expect(route).toContain("p?.isAI !== true");
  });

  it('resets public state on the server and deletes old private role documents', () => {
    expect(route).toContain('tx.update(gameRef');
    expect(route).toContain('tx.delete(roleDoc.ref)');
    expect(route).toContain("await tx.get(gameRef.collection('playerRoles'))");
    expect(route).toContain("status: 'lobby'");
    expect(route).toContain("phase: 'lobby'");
    expect(route).toContain('startedAt: null');
    expect(route).toContain('roles: {}');
    expect(route).toContain('wolfTeam: {}');
    expect(route).toContain('cultMembers: []');
    expect(route).toContain('vampiroBites: {}');
    expect(route).toContain('principeUsed: false');
    expect(route).toContain("await tx.get(gameRef.collection('nightResolutions'))");
    expect(route).toContain('tx.delete(resolutionDoc.ref)');
    expect(route).toContain("'wolfChat'");
    expect(route).toContain("'twinChat'");
    expect(route).toContain("'hermanosChat'");
    expect(route).toContain("'loversChat'");
    expect(route).toContain("'publicChat'");
    expect(route).toContain("'votes'");
    expect(route).toContain("'nightActions'");
    expect(route).toContain("'nightSubmissions'");
    expect(route).toContain('transientSnapshots');
    expect(route).toContain('cleanupCount > 400');
    expect(route).toContain('RESET_CLEANUP_TOO_LARGE');
  });

  it('does not reset the game document directly from the browser', () => {
    expect(gamePlay).not.toMatch(/updateDoc\(doc\(db,\s*['"]games['"][\s\S]{0,300}phase:\s*['"]lobby['"]/);
    expect(gamePlay).toContain("fetch('/api/reset-game'");
  });
});
