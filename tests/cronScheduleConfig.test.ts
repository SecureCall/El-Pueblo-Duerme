import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));

describe('authoritative phase recovery schedules', () => {
  it('runs the trusted night and day deadline resolvers every minute', () => {
    expect(config.crons).toContainEqual({ path: '/api/cron/resolve-nights', schedule: '* * * * *' });
    expect(config.crons).toContainEqual({ path: '/api/cron/resolve-days', schedule: '* * * * *' });
  });
});
