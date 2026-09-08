import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('lobby client actions', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'lib/firebase/lobbyActions.ts'),
    'utf8',
  );

  it('uses the current Firebase user token for every lobby mutation', () => {
    expect(source).toContain("const user = auth.currentUser;");
    expect(source).toContain('user.getIdToken()');
    expect(source).toContain('Authorization: `Bearer ${idToken}`');
    expect(source).toContain("credentials: 'include'");
  });

  it('centralizes the authoritative lobby endpoints', () => {
    expect(source).toContain("'/api/lobby-join'");
    expect(source).toContain("'/api/lobby-leave'");
    expect(source).toContain("'/api/lobby-kick'");
    expect(source).toContain("'/api/lobby-presence'");
    expect(source).toContain("'/api/lobby-fill-bots'");
    expect(source).toContain("'/api/game-start'");
  });
});
