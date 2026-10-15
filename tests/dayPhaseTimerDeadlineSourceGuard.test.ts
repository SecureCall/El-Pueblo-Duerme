import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'components/game/play/DayPhase.tsx'),
  'utf8',
);

describe('DayPhase timer deadline source guard', () => {
  it('uses the shared authoritative deadline helper instead of a local duration ref', () => {
    expect(source).toContain('getRemainingDaySeconds');
    expect(source).not.toContain('const dayDurationRef = useRef(60)');
    expect(source).not.toMatch(/function computeDayDuration\(/);
  });

  it('does not derive secondsLeft from dayStartedAt or a locally calculated duration', () => {
    expect(source).not.toMatch(/const\s+startedAt\s*=\s*game\.dayStartedAt/);
    expect(source).not.toMatch(/dayDurationRef\.current\s*-\s*elapsed/);
    expect(source).not.toMatch(/dayDurationRef\.current\s*=/);
  });
});
