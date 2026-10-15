import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'components/game/play/GamePlay.tsx'),
  'utf8',
);

describe('same-room rematch state', () => {
  it('resets status and phase to lobby together before a new game starts', () => {
    const rematchStart = source.indexOf('Mantener status y phase sincronizados');
    expect(rematchStart).toBeGreaterThanOrEqual(0);

    const rematchBlock = source.slice(rematchStart, rematchStart + 220);
    expect(rematchBlock).toContain("status: 'lobby'");
    expect(rematchBlock).toContain("phase: 'lobby'");
    expect(rematchBlock.indexOf("status: 'lobby'")).toBeLessThan(
      rematchBlock.indexOf("phase: 'lobby'"),
    );
  });
});
