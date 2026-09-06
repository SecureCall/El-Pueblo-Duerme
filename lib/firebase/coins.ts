import { doc, getDoc, query, where, getDocs, collection } from 'firebase/firestore';
import { db, auth } from './config';

export async function getUserCoins(userId: string): Promise<number> {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (snap.exists()) return snap.data().coins ?? 0;
  return 0;
}

/** @deprecated Use a server-authoritative reward endpoint instead. */
export async function addCoins(userId: string, amount: number, reason: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) throw new Error('No autenticado');
  if (reason !== 'video') throw new Error('Recompensa no soportada');

  const token = await currentUser.getIdToken();
  const response = await fetch('/api/award-coins', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('No se pudo conceder la recompensa');
}

export async function spendCoins(userId: string, _amount: number, itemId: string, _itemName: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== userId) throw new Error('No autenticado');

  const token = await currentUser.getIdToken();
  const response = await fetch('/api/spend-coins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ itemId }),
  });

  if (response.status === 409) throw new Error('Artículo ya comprado');
  if (response.status === 400) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'No se puede realizar la compra');
  }
  if (!response.ok) throw new Error('No se pudo realizar la compra');
}

export async function hasPurchased(userId: string, itemId: string): Promise<boolean> {
  const q = query(collection(db, 'users', userId, 'purchases'), where('itemId', '==', itemId));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function canWatchVideo(userId: string): Promise<boolean> {
  const q = query(collection(db, 'users', userId, 'coinHistory'), where('reason', '==', 'video'));
  const snap = await getDocs(q);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return snap.docs.filter((d: any) => (d.data().createdAt?.toMillis?.() ?? 0) >= startOfDay.getTime()).length < 5;
}
