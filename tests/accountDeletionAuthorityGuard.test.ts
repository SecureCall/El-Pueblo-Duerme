import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('account deletion authority', () => {
  it('keeps destructive Firestore cleanup out of the client', () => {
    const src = read('app/delete-account/page.tsx');
    expect(src).toContain("fetch('/api/delete-account'");
    expect(src).not.toContain('writeBatch');
    expect(src).not.toContain('deleteDoc');
    expect(src).not.toContain('getDocs');
    expect(src).not.toContain('collection(');
  });

  it('requires a recently authenticated Firebase token', () => {
    const src = read('app/api/delete-account/route.ts');
    expect(src).toContain('verifyIdToken(token)');
    expect(src).toContain('decoded.auth_time');
    expect(src).toContain('RECENT_AUTH_WINDOW_MS');
    expect(src).toContain('auth.deleteUser(uid)');
  });

  it('derives the deleted UID from the verified token', () => {
    const src = read('app/api/delete-account/route.ts');
    expect(src).toContain('const uid = decoded.uid');
    expect(src).not.toContain('body?.uid');
  });

  it('cleans owned subcollections server-side', () => {
    const src = read('app/api/delete-account/route.ts');
    expect(src).toContain('db.recursiveDelete(userRef)');
    expect(src).toContain("db.collection('gameInvites').doc(uid)");
    expect(src).toContain("db.collection('pushSubscriptions').doc(uid)");
    expect(src).toContain('playerBehavior/');
    expect(src).toContain('presence/');
  });

  it('removes the account from other users friend references', () => {
    const src = read('app/api/delete-account/route.ts');
    expect(src).toContain("where('friends', 'array-contains', uid)");
    expect(src).toContain("where('friendRequests', 'array-contains', uid)");
    expect(src).toContain("filter((id: unknown) => id !== uid)");
  });

  it('does not attempt a second client-side Auth deletion', () => {
    const src = read('app/delete-account/page.tsx');
    expect(src).toContain('signOut(auth)');
    expect(src).not.toContain('deleteUser(user)');
  });
});
