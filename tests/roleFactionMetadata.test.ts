import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const roles = readFileSync(resolve(process.cwd(), 'components/game/play/roles.ts'), 'utf8');
const nightEngine = readFileSync(resolve(process.cwd(), 'lib/server/nightResolutionEngine.ts'), 'utf8');

describe('role faction metadata', () => {
  it('keeps Maldito on the village side until the server transforms it', () => {
    expect(roles).toMatch(/'Maldito': \{\s*name: 'Maldito',\s*team: 'village'/);
    expect(nightEngine).toContain("roles[primaryTarget] === 'Maldito'");
    expect(nightEngine).toContain("roles[primaryTarget] = 'Lobo'");
  });
});
