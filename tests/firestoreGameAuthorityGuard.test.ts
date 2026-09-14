import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('Firestore game authority guard', () => {
  it('protects currentEvent and eventRound from host client writes', () => {
    expect(rules).toContain("'currentEvent','eventRound'");
    expect(rules).toMatch(/request\.auth\.uid == resource\.data\.hostUid[\s\S]{0,300}!touchesSensitiveFields\(\)/);
  });

  it('keeps the sensitive fields centralized in the game update guard', () => {
    expect(rules).toContain('function touchesSensitiveFields()');
    expect(rules).toContain("'nightActions','nightSubmissions'");
  });
});
