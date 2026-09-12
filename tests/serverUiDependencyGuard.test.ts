import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const gameStart = readFileSync(resolve(process.cwd(), 'app/api/game-start/route.ts'), 'utf8');
const awardXp = readFileSync(resolve(process.cwd(), 'app/api/award-xp/route.ts'), 'utf8');
const roleCatalog = readFileSync(resolve(process.cwd(), 'lib/server/roleCatalog.ts'), 'utf8');

describe('server/UI dependency boundary', () => {
  it('keeps game start on the server role catalog', () => {
    expect(gameStart).toContain("from '@/lib/server/roleCatalog'");
    expect(gameStart).not.toContain("from '@/components/game/play/roles'");
  });

  it('keeps XP calculation on the server role catalog', () => {
    expect(awardXp).toContain("from '@/lib/server/roleCatalog'");
    expect(awardXp).not.toContain("from '@/components/game/play/roles'");
  });

  it('keeps the server role catalog free of UI imports', () => {
    expect(roleCatalog).not.toContain("from '@/components/");
    expect(roleCatalog).not.toContain("from '@/app/");
  });
});
