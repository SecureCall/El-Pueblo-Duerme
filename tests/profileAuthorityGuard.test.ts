import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const route = readFileSync(resolve(process.cwd(), 'app/api/profile/route.ts'), 'utf8');
const client = readFileSync(resolve(process.cwd(), 'lib/firebase/friends.ts'), 'utf8');
const register = readFileSync(resolve(process.cwd(), 'components/auth/RegisterForm.tsx'), 'utf8');
const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

describe('Profile authority', () => {
  it('initializes profiles from authenticated server identity', () => {
    expect(route).toContain('const uid = await verifyAuthToken(req);');
    expect(route).toContain("const ref = db.collection('users').doc(uid);");
    expect(route).toContain("await ref.create({");
    expect(route).toContain("await ref.update({ displayName, photoURL });");
  });

  it('does not create or update user profiles directly from the browser', () => {
    expect(client).toContain("fetch('/api/profile'");
    expect(register).toContain("fetch('/api/profile'");
    expect(register).not.toContain("setDoc(doc(db, 'users'");
  });

  it('keeps client user updates limited to public profile fields', () => {
    expect(rules).toContain("onlyUpdating(['displayName','photoURL'])");
  });
});
