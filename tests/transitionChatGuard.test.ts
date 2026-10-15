import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('transition public chat payloads', () => {
  it.each([
    'components/game/play/DayTransition.tsx',
    'components/game/play/NightTransition.tsx',
  ])('%s includes the required public-chat type', (file) => {
    const source = readFileSync(resolve(process.cwd(), file), 'utf8');
    expect(source).toContain("type: 'normal'");
    expect(source).toContain("collection(db, 'games', gameId, 'publicChat')");
    if (file.endsWith('DayTransition.tsx')) {
      expect(source).toContain("game.phase !== 'day' && game.phase !== 'voting'");
      expect(source).toContain('Chat cerrado durante la noche');
    }
  });
});
