import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

describe('GamePlay private role synchronization', () => {
  it('subscribes the current player to their own private role document', () => {
    expect(source).toMatch(/doc\(db, 'games', gameId, 'playerRoles', user\.uid\)/);
    expect(source).toMatch(/setMyPrivateRole\(typeof role === 'string' && role\.length > 0 \? role : null\)/);
  });

  it('subscribes to the complete private role collection only for the host', () => {
    expect(source).toMatch(/game\.hostUid !== user\.uid/);
    expect(source).toMatch(/collection\(db, 'games', gameId, 'playerRoles'\)/);
    expect(source).toMatch(/setHostPrivateRoles\(roles\)/);
  });

  it('uses the private role for the local player UI and updates endgame checks when it changes', () => {
    expect(source).toMatch(/const myRole = myPrivateRole;/);
    expect(source).not.toMatch(/myPrivateRole \?\? game\.roles/);
    expect(source).toMatch(/\[game\?\.phase, game\?\.roundNumber, myPrivateRole\]/);
    expect(source).toMatch(/includes\(myPrivateRole \?\? ''\)/);
  });

  it('does not resolve the night from client submission snapshots', () => {
    expect(source).not.toContain('}, [game?.nightSubmissions, game?.phase, hostPrivateRoles]);');
    expect(source).toContain('Anti-softlock: ask the server to resolve at its authoritative deadline');
    expect(source).toContain('game.phaseEndsAt');
  });

  it('prefers the host private snapshot for host-side role-dependent flows', () => {
    expect(source).toMatch(/const roles = hostPrivateRoles;/);
    expect(source).not.toMatch(/game\.roles/);
  });
});
