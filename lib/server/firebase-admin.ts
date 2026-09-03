import { initAdminApp } from '@/lib/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';

/** Server-only Firebase Admin SDK adapter used by authoritative game routes. */
export function getSdks() {
  const app = initAdminApp();
  return { app, db: getFirestore(app) };
}
