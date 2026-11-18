import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const client = readFileSync(resolve(process.cwd(), 'components/game/play/RoleReveal.tsx'), 'utf8');
const route = readFileSync(resolve(process.cwd(), 'app/api/private-team/route.ts'), 'utf8');

describe('private wolf teammate lookup authentication', () => {
  it('sends the current Firebase user's ID token to the private-team endpoint', () => {
    expect(client).toContain("import { getAuth } from 'firebase/auth'");
    expect(client).toMatch(/currentUser\?\.uid === userId/);
    expect(client).toMatch(/currentUser\.getIdToken\(\)/);
    expect(client).toMatch(/Authorization:\s*`Bearer \$\{token\}`/);
  });

  it('keeps the private-team endpoint protected by Firebase token verification', () => {
    expect(route).toMatch(/const uid = await verifyAuthToken\(req\)/);
    expect(route).toMatch(/if \(!uid\).*status: 401/s);
    expect(route).toMatch(/players\.find\(\(player\) => player\.uid === uid\)/);
  });
});
