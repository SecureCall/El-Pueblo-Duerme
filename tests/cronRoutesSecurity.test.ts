import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const nightRoute = readFileSync(resolve(process.cwd(), 'app/api/cron/resolve-nights/route.ts'), 'utf8');
const dayRoute = readFileSync(resolve(process.cwd(), 'app/api/cron/resolve-days/route.ts'), 'utf8');

describe('server-side phase recovery endpoint guards', () => {
  it('rejects scheduler calls without the trusted server authorization check', () => {
    for (const route of [nightRoute, dayRoute]) {
      expect(route).toContain('isAuthorizedServerRequest(request)');
      expect(route).toContain("status: 401");
      expect(route).toContain("request.headers.get('authorization')");
      expect(route).toContain('MAX_GAMES_PER_TICK');
    }
  });

  it('returns a failing HTTP status when a delegated resolver has a server error', () => {
    for (const route of [nightRoute, dayRoute]) {
      expect(route).toContain('results.some((result) => result.status >= 500)');
      expect(route).toContain('status: hasServerFailure ? 502 : 200');
      expect(route).toContain('ok: !hasServerFailure');
    }
  });

  it('filters by phase before applying the recovery batch limit', () => {
    const nightPhaseFilter = nightRoute.indexOf(".where('phase', '==', 'night')");
    const nightDeadlineFilter = nightRoute.indexOf(".where('phaseEndsAt', '<=', now)");
    const nightLimit = nightRoute.indexOf('.limit(MAX_GAMES_PER_TICK)');
    expect(nightPhaseFilter).toBeGreaterThanOrEqual(0);
    expect(nightDeadlineFilter).toBeGreaterThan(nightPhaseFilter);
    expect(nightLimit).toBeGreaterThan(nightDeadlineFilter);
    expect(nightRoute).toContain('resolveNight(');

    const dayPhaseFilter = dayRoute.indexOf(".where('phase', 'in', ['day', 'voting'])");
    const dayDeadlineFilter = dayRoute.indexOf(".where('phaseEndsAt', '<=', now)");
    const dayLimit = dayRoute.indexOf('.limit(MAX_GAMES_PER_TICK)');
    expect(dayPhaseFilter).toBeGreaterThanOrEqual(0);
    expect(dayDeadlineFilter).toBeGreaterThan(dayPhaseFilter);
    expect(dayLimit).toBeGreaterThan(dayDeadlineFilter);
    expect(dayRoute).toContain('resolveDay(');
  });
});
