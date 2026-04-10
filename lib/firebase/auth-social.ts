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
  'auth/operation-not-allowed': 'Este método de acceso no está habilitado.',
  'auth/user-cancelled': '',
  'auth/cancelled-popup-request': '',
};

async function signInWithProvider(provider: GoogleAuthProvider | FacebookAuthProvider): Promise<string | null> {
  try {
    await signInWithRedirect(auth, provider);
    return null;
  } catch (err: any) {
    console.error('[Auth redirect error]', err?.code, err?.message);
    const msg = errorMessages[err?.code];
    if (msg === undefined) {
      return err?.message ? `Error: ${err.message}` : 'Error al iniciar sesión. Inténtalo de nuevo.';
    }
    return msg || null;
  }
}

export async function handleRedirectResult(): Promise<{ result: UserCredential | null; error: string | null }> {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      await ensureUserDocument(result);
    }
    return { result, error: null };
  } catch (err: any) {
    console.error('[Auth redirect result error]', err?.code, err?.message);
    const msg = errorMessages[err?.code] ?? (err?.message ? `Error: ${err.message}` : 'Error al iniciar sesión. Inténtalo de nuevo.');
    return { result: null, error: msg || null };
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
