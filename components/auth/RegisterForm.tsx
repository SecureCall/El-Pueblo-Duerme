'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { signInWithGoogle, signInWithFacebook } from '@/lib/firebase/auth-social';
import { Loader2, Mail, Lock, User } from 'lucide-react';

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    setLoading(true);
    setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        displayName: name,
        email,
        photoURL: '',
        coins: 100,
        createdAt: serverTimestamp(),
      });
      router.push('/');
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
        'auth/weak-password': 'La contraseña es demasiado débil.',
        'auth/invalid-email': 'El correo no es válido.',
      };
      setError(msgs[err.code] ?? 'Error al crear la cuenta. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setSocialLoading('google');
    setError('');
    try {
      await signInWithGoogle();
      router.push('/');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') setError('Error con Google.');
    } finally {
      setSocialLoading(null);
    }
  };

  const handleFacebook = async () => {
    setSocialLoading('facebook');
    setError('');
    try {
      await signInWithFacebook();
      router.push('/');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') setError('Error con Facebook.');
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <button
          type="button"
          onClick={handleGoogle}
          disabled={!!socialLoading || loading}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 px-4 rounded-xl transition-all disabled:opacity-60"
        >
          {socialLoading === 'google' ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Registrarse con Google
        </button>

        <button
          type="button"
          onClick={handleFacebook}
          disabled={!!socialLoading || loading}
          className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold py-3 px-4 rounded-xl transition-all disabled:opacity-60"
        >
          {socialLoading === 'facebook' ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          )}
          Registrarse con Facebook
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-xs">o con correo</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Tu nombre o apodo"
            required
            disabled={loading}
            className="w-full bg-white/5 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/50 transition-colors"
          />
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            disabled={loading}
            className="w-full bg-white/5 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/50 transition-colors"
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
            disabled={loading}
            className="w-full bg-white/5 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/50 transition-colors"
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-white/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Crear Cuenta Gratis
        </button>
      </form>

      <p className="text-center text-white/40 text-sm">
        ¿Ya tienes cuenta?{' '}
        <a href="/login" className="text-white hover:underline transition-colors">
          Inicia sesión
        </a>
      </p>
    </div>
  );
}
