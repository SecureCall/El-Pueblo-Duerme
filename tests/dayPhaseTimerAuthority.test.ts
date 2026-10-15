import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('DayPhase timer authority', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'components/game/play/DayPhase.tsx'),
    'utf8',
  );

  it('uses the server-authoritative phaseEndsAt instead of rebuilding the deadline locally', () => {
    expect(source).toContain('game.phaseEndsAt');
    expect(source).not.toContain('computeDayDuration');
    expect(source).not.toContain('dayDurationRef.current = mech');
    expect(source).not.toContain('game.currentEvent?.mechanical');
  });

  it('does not derive the authoritative day deadline from dayStartedAt', () => {
    expect(source).not.toContain('const startedAt = game.dayStartedAt');
    expect(source).not.toContain('(Date.now() - startedAt) / 1000');
  });
});
