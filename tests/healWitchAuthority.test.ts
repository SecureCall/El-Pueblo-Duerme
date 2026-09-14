import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dayRoute = readFileSync(resolve(process.cwd(), 'app/api/day-resolve/route.ts'), 'utf8');

describe('authoritative heal witch chaos event', () => {
  it('restores both witch potions only in the authoritative day commit', () => {
    expect(dayRoute).toMatch(/currentEvent\?\.mechanical === 'healWitch'/);
    expect(dayRoute).toMatch(/Object\.values\(snapshot\.rolesByUid\)\.includes\('Hechicera'\)/);
    expect(dayRoute).toMatch(/const hechiceraLifeUsed = healWitchActive \? false : current\.hechiceraLifeUsed === true/);
    expect(dayRoute).toMatch(/const hechiceraPoisonUsed = healWitchActive \? false : current\.hechiceraPoisonUsed === true/);
    expect(dayRoute).toMatch(/hechiceraLifeUsed,\s*hechiceraPoisonUsed,/);
  });

  it('does not take potion state from the resolver client patch', () => {
    expect(dayRoute).not.toMatch(/hechiceraLifeUsed:\s*result\.statePatch\.hechiceraLifeUsed/);
    expect(dayRoute).not.toMatch(/hechiceraPoisonUsed:\s*result\.statePatch\.hechiceraPoisonUsed/);
  });
});
