import { doc, getDoc, updateDoc, increment, collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

export async function getUserCoins(userId: string): Promise<number> {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data().coins ?? 0;
  }
  return 0;
}

export async function addCoins(userId: string, amount: number, reason: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { coins: increment(amount) });
  await addDoc(collection(db, 'users', userId, 'coinHistory'), {
    amount,
    reason,
    createdAt: serverTimestamp(),
  });
}

export async function spendCoins(userId: string, amount: number, itemId: string, itemName: string): Promise<void> {
  const coins = await getUserCoins(userId);
  if (coins < amount) throw new Error('Monedas insuficientes');
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { coins: increment(-amount) });
  await addDoc(collection(db, 'users', userId, 'purchases'), {
    itemId,
    itemName,
    amount,
    purchasedAt: serverTimestamp(),
  });
}

export async function hasPurchased(userId: string, itemId: string): Promise<boolean> {
  const q = query(collection(db, 'users', userId, 'purchases'), where('itemId', '==', itemId));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function canWatchVideo(userId: string): Promise<boolean> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const q = query(
    collection(db, 'users', userId, 'coinHistory'),
    where('reason', '==', 'video'),
  );
  const snap = await getDocs(q);
  const todayVideos = snap.docs.filter((d: any) => {
    const ts = d.data().createdAt?.toMillis?.() ?? 0;
    return ts >= startOfDay;
  });
  return todayVideos.length < 5;
}
