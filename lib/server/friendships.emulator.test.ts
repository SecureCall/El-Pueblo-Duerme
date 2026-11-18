import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { applyFriendAction } from '@/lib/server/friendships';

const projectId = 'demo-el-pueblo-duerme-friends';
const ids = {
  alice: 'friends-emulator-alice',
  bob: 'friends-emulator-bob',
};

let app: App;
let db: Firestore;

beforeAll(() => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST must be set to run friendship transaction emulator tests');
  }
  app = initializeApp({ projectId }, 'friendships-transaction-emulator-tests');
  db = getFirestore(app);
});

beforeEach(async () => {
  await Promise.all([
    db.doc(`users/${ids.alice}`).set({
      uid: ids.alice, friends: [], friendRequests: [],
    }),
    db.doc(`users/${ids.bob}`).set({
      uid: ids.bob, friends: [], friendRequests: [],
    }),
  ]);
});

afterAll(async () => {
  if (app) await deleteApp(app);
});

describe('friendship transactions against Firestore emulator', () => {
  it('serializes two concurrent accept attempts so only one consumes the request', async () => {
    await db.doc(`users/${ids.alice}`).update({
      friendRequests: [ids.bob],
    });

    const attempts = await Promise.allSettled([
      applyFriendAction(db, ids.alice, ids.bob, 'accept'),
      applyFriendAction(db, ids.alice, ids.bob, 'accept'),
    ]);

    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(result => result.status === 'rejected')).toHaveLength(1);

    const [alice, bob] = await Promise.all([
      db.doc(`users/${ids.alice}`).get(),
      db.doc(`users/${ids.bob}`).get(),
    ]);
    expect(alice.data()?.friends).toContain(ids.bob);
    expect(bob.data()?.friends).toContain(ids.alice);
    expect(alice.data()?.friendRequests).not.toContain(ids.bob);
  });

  it('keeps concurrent duplicate sends idempotent', async () => {
    await Promise.all([
      applyFriendAction(db, ids.alice, ids.bob, 'send'),
      applyFriendAction(db, ids.alice, ids.bob, 'send'),
    ]);

    const bob = await db.doc(`users/${ids.bob}`).get();
    expect(bob.data()?.friendRequests).toEqual([ids.alice]);
  });

  it('keeps both profiles consistent after concurrent reciprocal removals', async () => {
    await Promise.all([
      db.doc(`users/${ids.alice}`).update({ friends: [ids.bob] }),
      db.doc(`users/${ids.bob}`).update({ friends: [ids.alice] }),
    ]);

    await Promise.all([
      applyFriendAction(db, ids.alice, ids.bob, 'remove'),
      applyFriendAction(db, ids.bob, ids.alice, 'remove'),
    ]);

    const [alice, bob] = await Promise.all([
      db.doc(`users/${ids.alice}`).get(),
      db.doc(`users/${ids.bob}`).get(),
    ]);
    expect(alice.data()?.friends).not.toContain(ids.bob);
    expect(bob.data()?.friends).not.toContain(ids.alice);
  });
});
