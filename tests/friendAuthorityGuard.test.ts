import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = readFileSync(resolve(process.cwd(), 'app/api/friends/route.ts'), 'utf8');
const client = readFileSync(resolve(process.cwd(), 'lib/firebase/friends.ts'), 'utf8');
const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('Friend relationship authority', () => {
  it('requires authenticated server authority and derives actor from the token', () => {
    expect(route).toContain("const uid = await verifyAuthToken(req);");
    expect(route).toContain("if (!uid) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });");
    expect(route).toContain("tx.update(targetRef, { friendRequests: FieldValue.arrayUnion(uid) });");
    expect(route).toContain("tx.update(targetRef, { friends: FieldValue.arrayUnion(uid) });");
    expect(route).toContain("tx.update(targetRef, { friends: FieldValue.arrayRemove(uid) });");
  });

  it('does not mutate relationship arrays directly from the browser', () => {
    expect(client).not.toContain('arrayUnion');
    expect(client).not.toContain('arrayRemove');
    expect(client).toContain("fetch('/api/friends'");
    expect(client).toContain('Authorization:');
  });

  it('does not expose a Firestore client write path for friendRequests', () => {
    expect(rules).toContain("onlyUpdating(['displayName','photoURL'])");
    expect(rules).not.toContain("onlyUpdating(['friendRequests'])");
  });
});
