import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';
import { authFetch } from './authFetch';

export async function getUserCoins(userId: string): Promise<number> {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (snap.exists()) return snap.data().coins ?? 0;
  return 0;
}

/** Coin minting is intentionally server-only. */
export async function addCoins(_userId: string, _amount: number, _reason: string): Promise<void> {
  throw new Error('Las monedas solo pueden otorgarse desde el servidor');
}

export async function spendCoins(_userId: string, amount: number, itemId: string, _itemName: string): Promise<void> {
  if (!Number.isInteger(amount) || amount <= 0 || !itemId) {
    throw new Error('Compra no válida');
  }

  const response = await authFetch('/api/purchase', {
    method: 'POST',
    body: JSON.stringify({ itemId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'No se pudo completar la compra');
}

export async function hasPurchased(userId: string, itemId: string): Promise<boolean> {
  const q = query(collection(db, 'users', userId, 'purchases'), where('itemId', '==', itemId));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function canWatchVideo(userId: string): Promise<boolean> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const q = query(collection(db, 'users', userId, 'coinHistory'), where('reason', '==', 'video'));
  const snap = await getDocs(q);
  const todayVideos = snap.docs.filter((d: any) => {
    const ts = d.data().createdAt?.toMillis?.() ?? 0;
    return ts >= startOfDay;
  });
  return todayVideos.length < 5;
}
