import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFriendAction } from '@/lib/server/friendships';

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: (value: string) => ({ operation: 'arrayUnion', value }),
    arrayRemove: (value: string) => ({ operation: 'arrayRemove', value }),
  },
}));

type UserData = { friends?: unknown; friendRequests?: unknown };
const users = new Map<string, UserData>();
let updates: Array<{ path: string; data: Record<string, unknown> }>;
let transactionCalls: number;

function makeDb() {
  const db = {
    collection: (name: string) => ({
      doc: (uid: string) => ({ path: `${name}/${uid}` }),
    }),
    runTransaction: async (callback: (tx: {
      get: (ref: { path: string }) => Promise<{ exists: boolean; data: () => UserData | undefined }>;
      update: (ref: { path: string }, data: Record<string, unknown>) => void;
    }) => Promise<void>) => {
      transactionCalls += 1;
      const tx = {
        get: async (ref: { path: string }) => {
          const data = users.get(ref.path);
          return { exists: Boolean(data), data: () => data };
        },
        update: (ref: { path: string }, data: Record<string, unknown>) => {
          updates.push({ path: ref.path, data });
        },
      };
      await callback(tx);
    },
  };
  return db as never;
}

describe('server friendship transaction service', () => {
  beforeEach(() => {
    users.clear();
    users.set('users/alice', { friends: [], friendRequests: [] });
    users.set('users/bob', { friends: [], friendRequests: [] });
    updates = [];
    transactionCalls = 0;
  });

  it('sends a request to the recipient in one transaction', async () => {
    await applyFriendAction(makeDb(), 'alice', 'bob', 'send');
    expect(transactionCalls).toBe(1);
    expect(updates).toEqual([{
      path: 'users/bob',
      data: { friendRequests: { operation: 'arrayUnion', value: 'alice' } },
    }]);
  });

  it('does not write a duplicate pending request', async () => {
    users.set('users/bob', { friends: [], friendRequests: ['alice'] });
    await applyFriendAction(makeDb(), 'alice', 'bob', 'send');
    expect(transactionCalls).toBe(1);
    expect(updates).toEqual([]);
  });

  it('accepts a request and updates both friend lists atomically', async () => {
    users.set('users/alice', { friends: [], friendRequests: ['bob'] });
    users.set('users/bob', { friends: [], friendRequests: [] });
    await applyFriendAction(makeDb(), 'alice', 'bob', 'accept');
    expect(updates).toEqual([
      {
        path: 'users/alice',
        data: {
          friends: ['bob'],
          friendRequests: { operation: 'arrayRemove', value: 'bob' },
        },
      },
      { path: 'users/bob', data: { friends: ['alice'] } },
    ]);
  });

  it('rejects acceptance when no pending request exists', async () => {
    await expect(applyFriendAction(makeDb(), 'alice', 'bob', 'accept'))
      .rejects.toThrow('REQUEST_NOT_FOUND');
    expect(updates).toEqual([]);
  });

  it('rejects a request by removing it only from the recipient profile', async () => {
    users.set('users/alice', { friends: [], friendRequests: ['bob'] });
    await applyFriendAction(makeDb(), 'alice', 'bob', 'reject');
    expect(updates).toEqual([{
      path: 'users/alice',
      data: { friendRequests: { operation: 'arrayRemove', value: 'bob' } },
    }]);
  });

  it('removes friendship from both profiles in one transaction', async () => {
    users.set('users/alice', { friends: ['bob', 'carol'], friendRequests: [] });
    users.set('users/bob', { friends: ['alice', 'dave'], friendRequests: [] });
    await applyFriendAction(makeDb(), 'alice', 'bob', 'remove');
    expect(transactionCalls).toBe(1);
    expect(updates).toEqual([
      { path: 'users/alice', data: { friends: ['carol'] } },
      { path: 'users/bob', data: { friends: ['dave'] } },
    ]);
  });

  it('fails without writes when either profile does not exist', async () => {
    users.delete('users/bob');
    await expect(applyFriendAction(makeDb(), 'alice', 'bob', 'send'))
      .rejects.toThrow('USER_NOT_FOUND');
    expect(updates).toEqual([]);
  });

  it('prevents sending a request to an existing friend', async () => {
    users.set('users/alice', { friends: ['bob'], friendRequests: [] });
    await expect(applyFriendAction(makeDb(), 'alice', 'bob', 'send'))
      .rejects.toThrow('ALREADY_FRIENDS');
    expect(updates).toEqual([]);
  });
});
