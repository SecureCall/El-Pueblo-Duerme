import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { arrayUnion, doc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'demo-el-pueblo-duerme-friends';
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users/alice'), {
      uid: 'alice', displayName: 'Alice', photoURL: '',
      friends: [], friendRequests: [],
    });
    await setDoc(doc(db, 'users/bob'), {
      uid: 'bob', displayName: 'Bob', photoURL: '',
      friends: [], friendRequests: [],
    });
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

describe('Firestore friendship security rules (emulator)', () => {
  it('allows a user to send their own UID as a friend request', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users/bob'), {
      friendRequests: arrayUnion('alice'),
    }));
  });

  it('rejects a request that inserts another user UID', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(db, 'users/bob'), {
      friendRequests: arrayUnion('mallory'),
    }));
  });

  it('rejects direct client edits to the caller friend list', async () => {
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(db, 'users/alice'), {
      friends: arrayUnion('bob'),
    }));
  });

  it('allows the profile owner to reject a pending request', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'users/bob'), {
        friendRequests: ['alice'],
      });
    });
    const db = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users/bob'), {
      friendRequests: [],
    }));
  });

  it('rejects another user removing a request from the recipient profile', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'users/bob'), {
        friendRequests: ['alice'],
      });
    });
    const db = testEnv.authenticatedContext('alice').firestore();
    await assertFails(updateDoc(doc(db, 'users/bob'), {
      friendRequests: [],
    }));
  });
});
