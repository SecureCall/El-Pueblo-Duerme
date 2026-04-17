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
googleProvider.setCustomParameters({ prompt: 'select_account' });

const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('email');
facebookProvider.addScope('public_profile');

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

const errorMessages: Record<string, string> = {
  'auth/account-exists-with-different-credential': 'Ya existe una cuenta con ese correo. Usa otro método de acceso.',
  'auth/operation-not-allowed': 'Este método de acceso no está habilitado en Firebase.',
  'auth/popup-closed-by-user': '',
  'auth/cancelled-popup-request': '',
  'auth/popup-blocked': 'El navegador bloqueó la ventana emergente. Permite las ventanas emergentes e inténtalo de nuevo.',
  'auth/user-cancelled': '',
};

async function signInWithProvider(provider: GoogleAuthProvider | FacebookAuthProvider): Promise<string | null> {
  try {
    const result = await signInWithPopup(auth, provider);
    await ensureUserDocument(result);
    return null;
  } catch (err: any) {
    console.error('[Auth popup error]', err?.code, err?.message);
    const msg = errorMessages[err?.code];
    if (msg === undefined) {
      return err?.message ? `Error: ${err.message}` : 'Error al iniciar sesión. Inténtalo de nuevo.';
    }
    return msg || null;
  }
}

export async function signInWithGoogle(): Promise<string | null> {
  return signInWithProvider(googleProvider);
}

export async function signInWithFacebook(): Promise<string | null> {
  return signInWithProvider(facebookProvider);
}

export async function signInWithInstagram(): Promise<string | null> {
  return signInWithProvider(facebookProvider);
}

/** Kept for backward-compat — no longer needed with popup flow */
export async function handleRedirectResult(): Promise<{ result: UserCredential | null; error: string | null }> {
  return { result: null, error: null };
}
