import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export type FriendAction = 'send' | 'accept' | 'reject' | 'remove';

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Applies a friendship mutation in one Firestore transaction.
 * The caller must pass the UID obtained from a verified Firebase ID token.
 */
export async function applyFriendAction(
  db: Firestore,
  uid: string,
  otherUid: string,
  action: FriendAction,
): Promise<void> {
  const myRef = db.collection('users').doc(uid);
  const otherRef = db.collection('users').doc(otherUid);

  await db.runTransaction(async tx => {
    const [mySnap, otherSnap] = await Promise.all([tx.get(myRef), tx.get(otherRef)]);
    if (!mySnap.exists || !otherSnap.exists) throw new Error('USER_NOT_FOUND');

    const mine = mySnap.data()!;
    const theirs = otherSnap.data()!;
    const myFriends = stringList(mine.friends);
    const otherFriends = stringList(theirs.friends);
    const myRequests = stringList(mine.friendRequests);
    const otherRequests = stringList(theirs.friendRequests);

    switch (action) {
      case 'send': {
        if (myFriends.includes(otherUid) || otherFriends.includes(uid)) throw new Error('ALREADY_FRIENDS');
        if (!otherRequests.includes(uid)) {
          tx.update(otherRef, { friendRequests: FieldValue.arrayUnion(uid) });
        }
        return;
      }
      case 'accept': {
        if (!myRequests.includes(otherUid)) throw new Error('REQUEST_NOT_FOUND');
        tx.update(myRef, {
          friends: Array.from(new Set([...myFriends, otherUid])),
          friendRequests: FieldValue.arrayRemove(otherUid),
        });
        tx.update(otherRef, { friends: Array.from(new Set([...otherFriends, uid])) });
        return;
      }
      case 'reject': {
        if (!myRequests.includes(otherUid)) throw new Error('REQUEST_NOT_FOUND');
        tx.update(myRef, { friendRequests: FieldValue.arrayRemove(otherUid) });
        return;
      }
      case 'remove': {
        tx.update(myRef, { friends: myFriends.filter(id => id !== otherUid) });
        tx.update(otherRef, { friends: otherFriends.filter(id => id !== uid) });
        return;
      }
    }
  });
}
