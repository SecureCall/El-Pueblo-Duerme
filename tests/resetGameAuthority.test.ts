import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/reset-game/route.ts'), 'utf8');
const gamePlay = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

describe('rematch reset authority', () => {
  it('authenticates the caller and allows reset only after the game ended', () => {
    expect(route).toContain('verifyAuthToken(request)');
    expect(route).toContain("game.phase !== 'ended'");
    expect(route).toContain("game.hostUid !== user.uid && hostStillHere");
    expect(route).toContain("game.hostUid !== user.uid && !callerIsPlayer");
    expect(route).toContain("p?.isAI !== true");
  });

  it('resets public state on the server and deletes old private role documents', () => {
    expect(route).toContain('tx.update(gameRef');
    expect(route).toContain('tx.delete(roleDoc.ref)');
    expect(route).toContain("await tx.get(gameRef.collection('playerRoles'))");
    expect(route).toContain("phase: 'lobby'");
    expect(route).toContain('roles: {}');
  });

  it('does not reset the game document directly from the browser', () => {
    expect(gamePlay).not.toMatch(/updateDoc\(doc\(db,\s*['"]games['"][\s\S]{0,300}phase:\s*['"]lobby['"]/);
    expect(gamePlay).toContain("fetch('/api/reset-game'");
  });
});
