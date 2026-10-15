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

  it('only delegates overdue games in the matching phase', () => {
    expect(nightRoute).toContain("data.phase === 'night'");
    expect(nightRoute).toContain("where('phaseEndsAt', '<=', now)");
    expect(nightRoute).toContain('resolveNight(');
    expect(dayRoute).toContain("(data.phase === 'day' || data.phase === 'voting')");
    expect(dayRoute).toContain("where('phaseEndsAt', '<=', now)");
    expect(dayRoute).toContain('resolveDay(');
  });
});
