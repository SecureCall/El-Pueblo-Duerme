import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cazadorRoute = readFileSync(resolve(process.cwd(), 'app/api/cazador-shot/route.ts'), 'utf8');
const chivoRoute = readFileSync(resolve(process.cwd(), 'app/api/chivo-choice/route.ts'), 'utf8');

describe('authoritative special-action guards', () => {
  it('keeps Cazador authority on the server endpoint', () => {
    expect(cazadorRoute).toContain("collection('playerRoles').doc(pendingUid)");
    expect(cazadorRoute).toContain("hunterRole !== 'Cazador'");
    expect(cazadorRoute).toContain('db.runTransaction');
  });

  it('keeps Chivo authority on the server endpoint', () => {
    expect(chivoRoute).toContain("collection('playerRoles').doc(pendingUid)");
    expect(chivoRoute).toContain("role !== 'Chivo Expiatorio'");
    expect(chivoRoute).toContain('db.runTransaction');
  });
});
