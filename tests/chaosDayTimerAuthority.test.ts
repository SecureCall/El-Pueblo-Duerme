import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const route = readFileSync(resolve(process.cwd(), 'app/api/resolve-night/route.ts'), 'utf8');

describe('authoritative chaos day timer guard', () => {
  it('computes day duration from the server-side chaos event', () => {
    expect(route).toMatch(/event\?: ChaosEvent \| null/);
    expect(route).toMatch(/event\?\.mechanical === 'extraTime'/);
    expect(route).toMatch(/event\?\.mechanical === 'halfTime'/);
  });

  it('persists the authoritative duration into phaseEndsAt', () => {
    expect(route).toMatch(/phaseEndsAt: finalWinner \? null : nextDayEnd\(now, aliveCount, chaosEvent\)/);
  });

  it('keeps the chaos event itself as the source of truth', () => {
    expect(route).toMatch(/currentEvent: chaosEvent/);
    expect(route).toMatch(/eventRound: chaosEvent \? roundNumber : null/);
  });
});
