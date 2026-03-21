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

export async function handleRedirectResult(): Promise<{ result: UserCredential | null; error: string | null }> {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      await ensureUserDocument(result);
    }
    return { result, error: null };
  } catch (err: any) {
    console.error('[Auth redirect error]', err?.code, err?.message);
    const msgs: Record<string, string> = {
      'auth/account-exists-with-different-credential': 'Ya existe una cuenta con ese correo. Usa otro método de acceso.',
      'auth/popup-blocked': 'El navegador bloqueó el acceso. Permite las ventanas emergentes.',
      'auth/cancelled-popup-request': '',
      'auth/operation-not-allowed': 'Este método de acceso no está habilitado. Contacta al administrador.',
      'auth/invalid-oauth-client-id': 'Error de configuración OAuth. Contacta al administrador.',
    };
    const msg = msgs[err?.code] ?? (err?.message ? `Error: ${err.message}` : 'Error al iniciar sesión. Inténtalo de nuevo.');
    return { result: null, error: msg };
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
