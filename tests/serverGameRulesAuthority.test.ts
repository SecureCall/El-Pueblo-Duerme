import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve(process.cwd(), 'lib/server/gameRules.ts'), 'utf8');
const cazador = readFileSync(resolve(process.cwd(), 'app/api/cazador-shot/route.ts'), 'utf8');
const day = readFileSync(resolve(process.cwd(), 'lib/server/dayResolutionEngine.ts'), 'utf8');
const night = readFileSync(resolve(process.cwd(), 'lib/server/nightResolutionEngine.ts'), 'utf8');

describe('server game-rules authority', () => {
  it('keeps the win-condition engine in a server-safe module', () => {
    expect(rules).toContain('export function checkWinCondition');
    expect(rules).not.toContain("from '@/components/game/play/");
  });

  it('moves Cazador off the UI rules module', () => {
    expect(cazador).toContain("from '@/lib/server/gameRules'");
    expect(cazador).not.toContain("from '@/components/game/play/roles'");
  });

  it('requires day and night engines to consume the server-safe rules module', () => {
    expect(day).toContain("from '@/lib/server/gameRules'");
    expect(day).not.toContain("from '@/components/game/play/roles'");
    expect(night).toContain("from '@/lib/server/gameRules'");
    expect(night).not.toContain("from '@/components/game/play/roles'");
  });
});
