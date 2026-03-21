import {
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('email');
facebookProvider.addScope('public_profile');

async function ensureUserDocument(cred: UserCredential) {
  const { user } = cred;
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName: user.displayName ?? 'Jugador',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      coins: 100,
      createdAt: serverTimestamp(),
    });
  }
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserDocument(cred);
  return cred;
}

export async function signInWithFacebook(): Promise<UserCredential> {
  const cred = await signInWithPopup(auth, facebookProvider);
  await ensureUserDocument(cred);
  return cred;
}
