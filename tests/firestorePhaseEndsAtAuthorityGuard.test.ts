import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('Firestore phase deadline authority guard', () => {
  it('treats phaseEndsAt as a sensitive server-owned game field', () => {
    expect(rules).toContain("'phaseEndsAt'");
    expect(rules).toMatch(/function touchesSensitiveFields\(\)[\s\S]{0,4000}'phaseEndsAt'/);
  });
});
