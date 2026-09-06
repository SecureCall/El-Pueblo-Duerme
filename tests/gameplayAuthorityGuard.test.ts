import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('GamePlay authority guard', () => {
  const source = readFileSync(resolve(process.cwd(), 'components/game/play/GamePlay.tsx'), 'utf8');

  it('does not directly transition roleReveal to night in the client', () => {
    expect(source).not.toMatch(/updateDoc\(doc\(db,\s*['"]games['"][\s\S]{0,500}phase:\s*['"]night['"]/);
  });

  it('does not directly write legacy nightActions or nightSubmissions from submitNightAction', () => {
    const match = source.match(/const submitNightAction[\s\S]*?(?=\n\s*const |\n\s*useEffect|\n\s*return \()/);
    expect(match?.[0] ?? '').not.toMatch(/updateDoc[\s\S]*(nightActions|nightSubmissions)/);
  });
});
