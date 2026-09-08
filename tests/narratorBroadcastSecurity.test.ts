import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Narrator broadcast authority', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'app/api/narrator-broadcast/route.ts'),
    'utf8',
  );

  it('requires authentication and host authority', () => {
    expect(source).toContain('verifyAuthToken(req)');
    expect(source).toContain("if (game.hostUid !== uid)");
    expect(source).toContain("throw new Error('NOT_HOST')");
  });

  it('only accepts the canonical broadcast types and bounded text', () => {
    expect(source).toContain("const TYPES = new Set(['warning', 'suspicion', 'chaos', 'irony', 'accusation'])");
    expect(source).toContain('text.length > 280');
    expect(source).toContain('tx.update(gameRef');
    expect(source).toContain('narratorBroadcast');
  });

  it('never trusts a client timestamp', () => {
    expect(source).toContain('triggeredAt: Date.now()');
    expect(source).not.toContain('triggeredAt: body');
  });
});
