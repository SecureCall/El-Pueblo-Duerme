import {
  doc, getDoc, setDoc,
  collection, query, where, getDocs, onSnapshot, serverTimestamp,
  addDoc, deleteDoc, Unsubscribe, Timestamp,
} from 'firebase/firestore';
import { auth, db } from './config';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  friends: string[];
  friendRequests: string[];
}

export interface PresenceData {
  online: boolean;
  displayName: string;
  photoURL: string;
  lastSeen: Timestamp | null;
}

export interface GameInvite {
  id: string;
  gameId: string;
  gameCode: string;
  gameName: string;
  hostUid: string;
  hostName: string;
  sentAt: Timestamp | null;
}

export async function ensureUserProfile(uid: string, displayName: string, photoURL: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid, displayName, photoURL,
      friends: [], friendRequests: [],
      xp: 0, gamesPlayed: 0, gamesWon: 0, consecutiveWins: 0,
    });
  } else {
    // Actualiza nombre/foto; añade campos de stats si no existen (usuarios antiguos)
    const data = snap.data();
    await setDoc(ref, {
      displayName, photoURL,
      ...(data.xp === undefined ? { xp: 0 } : {}),
      ...(data.gamesPlayed === undefined ? { gamesPlayed: 0 } : {}),
      ...(data.gamesWon === undefined ? { gamesWon: 0 } : {}),
      ...(data.consecutiveWins === undefined ? { consecutiveWins: 0 } : {}),
    }, { merge: true });
  }
}

export async function setPresence(uid: string, displayName: string, photoURL: string, online: boolean) {
  await setDoc(doc(db, 'presence', uid), { online, displayName, photoURL, lastSeen: serverTimestamp() }, { merge: true });
}

export async function searchUserByName(name: string): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), where('displayName', '>=', name), where('displayName', '<=', name + '\uf8ff'));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as UserProfile);
}

async function performFriendAction(action: 'send' | 'accept' | 'reject' | 'remove', expectedUid: string, otherUid: string) {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== expectedUid) {
    throw new Error('La sesión ha cambiado. Vuelve a iniciar sesión.');
  }
  if (!otherUid || otherUid === expectedUid) {
    throw new Error('Usuario no válido.');
  }

  const token = await currentUser.getIdToken();
  const response = await fetch('/api/friends', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, otherUid }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : 'No se pudo actualizar la amistad.');
  }
}

export async function sendFriendRequest(fromUid: string, toUid: string) {
  return performFriendAction('send', fromUid, toUid);
}

export async function acceptFriendRequest(myUid: string, fromUid: string) {
  return performFriendAction('accept', myUid, fromUid);
}

export async function rejectFriendRequest(myUid: string, fromUid: string) {
  return performFriendAction('reject', myUid, fromUid);
}

export async function removeFriend(myUid: string, friendUid: string) {
  return performFriendAction('remove', myUid, friendUid);
}

export function subscribeToMyProfile(uid: string, cb: (p: UserProfile) => void): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), snap => {
    if (snap.exists()) cb(snap.data() as UserProfile);
  });
}

export function subscribeToPresence(uids: string[], cb: (map: Record<string, PresenceData>) => void): Unsubscribe {
  if (uids.length === 0) { cb({}); return () => {}; }
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 10) chunks.push(uids.slice(i, i + 10));
  const maps: Record<string, PresenceData>[] = chunks.map(() => ({}));
  const unsubs = chunks.map((chunk, ci) => {
    const q = query(collection(db, 'presence'), where('__name__', 'in', chunk));
    return onSnapshot(q, snap => {
      const m: Record<string, PresenceData> = {};
      snap.docs.forEach(d => { m[d.id] = d.data() as PresenceData; });
      maps[ci] = m;
      cb(Object.assign({}, ...maps));
    });
  });
  return () => unsubs.forEach(u => u());
}

export async function sendGameInvite(toUid: string, gameId: string, gameCode: string, gameName: string, hostUid: string, hostName: string) {
  await addDoc(collection(db, 'gameInvites', toUid, 'items'), {
    gameId, gameCode, gameName, hostUid, hostName, sentAt: serverTimestamp(),
  });
}

export function subscribeToInvites(uid: string, cb: (invites: GameInvite[]) => void): Unsubscribe {
  const q = query(collection(db, 'gameInvites', uid, 'items'));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as GameInvite)));
  });
}

export async function dismissInvite(myUid: string, inviteId: string) {
  await deleteDoc(doc(db, 'gameInvites', myUid, 'items', inviteId));
}
