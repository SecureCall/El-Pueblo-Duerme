import {
  signInWithRedirect,
  getRedirectResult,
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

const instagramProvider = new FacebookAuthProvider();
instagramProvider.addScope('email');
instagramProvider.addScope('public_profile');

export async function ensureUserDocument(cred: UserCredential) {
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

export async function handleRedirectResult(): Promise<UserCredential | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      await ensureUserDocument(result);
    }
    return result;
  } catch {
    return null;
  }
}

export function signInWithGoogle(): Promise<void> {
  return signInWithRedirect(auth, googleProvider);
}

export function signInWithFacebook(): Promise<void> {
  return signInWithRedirect(auth, facebookProvider);
}

export function signInWithInstagram(): Promise<void> {
  return signInWithRedirect(auth, instagramProvider);
}
