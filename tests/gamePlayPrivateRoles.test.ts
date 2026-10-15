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
    expect(source).toMatch(/const myRole = myPrivateRole \?\? game\.roles\?\.\[user\.uid\]/);
    expect(source).toMatch(/\[game\?\.phase, game\?\.roundNumber, myPrivateRole\]/);
    expect(source).toMatch(/includes\(myPrivateRole \?\? ''\)/);
  });

  it('reruns the host night-completion gate when private role snapshots arrive', () => {
    expect(source).toContain('}, [game?.nightSubmissions, game?.phase, hostPrivateRoles]);');
  });

  it('prefers the host private snapshot for host-side role-dependent flows', () => {
    expect(source).toMatch(/Object\.keys\(hostPrivateRoles\)\.length > 0 \? hostPrivateRoles : \(game\.roles \?\? \{\}\)/);
  });
});
