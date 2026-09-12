import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/fantasma-message/route.ts'), 'utf8');
const helper = readFileSync(resolve(process.cwd(), 'lib/game/specialActions.ts'), 'utf8');

describe('Fantasma authority', () => {
  it('requires a pending dead ghost and a live target', () => {
    expect(route).toContain("pending.includes(actorUid)");
    expect(route).toContain("actor.isAlive === true");
    expect(route).toContain("target.isAlive !== true");
    expect(route).toContain('MAX_MESSAGE_LENGTH');
  });

  it('prevents unauthorized use and replays', () => {
    expect(route).toContain("used.includes(actorUid)");
    expect(route).toContain("throw new Error('FORBIDDEN')");
    expect(route).toContain("tx.update(gameRef, { fantasmaPending: nextPending, fantasmaUsed: [...used, actorUid] })");
  });

  it('has an authoritative client helper', () => {
    expect(helper).toContain("'/api/fantasma-message'");
    expect(helper).toContain('requestFantasmaMessage');
  });
});
