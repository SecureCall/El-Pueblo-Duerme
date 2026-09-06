import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('server AI night submission persistence', () => {
  const source = readFileSync(resolve(process.cwd(), 'lib/server/aiNight.ts'), 'utf8');

  it('uses a Firestore transaction for resolver-side AI submissions', () => {
    expect(source).toMatch(/db\.runTransaction\(async \(tx\) =>/);
    expect(source).toMatch(/tx\.create\(refs\[i\]/);
  });

  it('never uses merge writes for AI night submissions', () => {
    expect(source).not.toMatch(/nightSubmissions[\s\S]{0,500}batch\.set/);
    expect(source).not.toMatch(/nightSubmissions[\s\S]{0,500}set\([^\n]*merge:\s*true/);
  });

  it('skips an already existing round-scoped submission', () => {
    expect(source).toMatch(/if \(snapshots\[i\]\.exists\) continue;/);
    expect(source).toMatch(/\$\{write\.uid\}:\$\{round\}/);
  });
});
