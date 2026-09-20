import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('night submission authority guards', () => {
  it('does not trust client Firestore writes for night submissions', () => {
    const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
    expect(rules).toContain("match /games/{gameId}/nightSubmissions/{submissionId}");
    expect(rules).toContain('allow read, create, update, delete: if false;');
  });

  it('requires canonical server submission document identity', () => {
    const source = readFileSync(resolve(process.cwd(), 'lib/server/nightSubmissions.ts'), 'utf8');
    expect(source).toContain("const actorUid = typeof data.actorUid === 'string' ? data.actorUid : ''");
    expect(source).toContain('submission._documentId');
    expect(source).toContain('submission.actorUid}:${submission.roundNumber');
  });

  it('re-validates persisted submissions before resolution', () => {
    const resolver = readFileSync(resolve(process.cwd(), 'app/api/resolve-night/route.ts'), 'utf8');
    expect(resolver).toContain('validatePersistedNightSubmissions');
    expect(resolver).toContain('night_submission_role_mismatch');
    expect(resolver).toContain('claimNightResolution');
  });
});
