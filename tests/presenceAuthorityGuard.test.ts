import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');
const friends = readFileSync(resolve(process.cwd(), 'lib/firebase/friends.ts'), 'utf8');
const takeover = readFileSync(resolve(process.cwd(), 'app/api/host-takeover/route.ts'), 'utf8');

describe('global presence authority guards', () => {
  it('binds presence writes to the authenticated UID and a fixed schema', () => {
    expect(rules).toContain("match /presence/{userId}");
    expect(rules).toContain("request.auth.uid == userId");
    expect(rules).toContain("request.resource.data.keys().hasOnly(['uid','online','displayName','photoURL','lastSeen'])");
    expect(rules).toContain("request.resource.data.uid == request.auth.uid");
    expect(rules).toContain("request.resource.data.online is bool");
    expect(rules).toContain("request.resource.data.lastSeen is int");
    expect(rules).toContain("allow delete: if isAuth() && request.auth.uid == userId;");
  });

  it('uses numeric timestamps consistently because host takeover consumes lastSeen as milliseconds', () => {
    expect(friends).toContain("lastSeen: Date.now()");
    expect(friends).not.toContain("lastSeen: serverTimestamp()");
    expect(takeover).toContain("typeof hostPresenceSnap.data()?.lastSeen === 'number'");
    expect(takeover).toContain("getTakeoverDecision(game, uid, hostLastSeen, Date.now())");
  });
});
