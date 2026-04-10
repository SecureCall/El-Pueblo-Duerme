'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { signInWithGoogle, signInWithFacebook } from '@/lib/firebase/auth-social';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';

export function LoginForm() {
  const router = useRouter();
  const { user, isLoading, redirectError } = useAuth();

  useEffect(() => {
    if (!isLoading && user) router.push('/');
  }, [user, isLoading, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [fbLoading, setFbLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (redirectError) setError(redirectError);
  }, [redirectError]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/');
    } catch (err: any) {
      const msgs: Record<string, string> = {
        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
        'auth/user-not-found': 'No existe cuenta con ese correo.',
        'auth/wrong-password': 'Contraseña incorrecta.',
        'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
      };
      setError(msgs[err.code] ?? 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    const err = await signInWithGoogle();
    if (err) { setError(err); setGoogleLoading(false); }
  };

  const handleFacebook = async () => {
    setFbLoading(true);
    setError('');
    const err = await signInWithFacebook();
    if (err) { setError(err); setFbLoading(false); }
  };

  const busy = loading || googleLoading || fbLoading;

  return (
    <div className="space-y-5">
      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 active:scale-[0.98] text-gray-900 font-semibold text-sm rounded-xl py-3.5 transition-all shadow-lg disabled:opacity-50"
      >
        {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
        )}
        {googleLoading ? 'Conectando...' : 'Continuar con Google'}
      </button>

      {/* Facebook */}
      <button
        type="button"
        onClick={handleFacebook}
        disabled={busy}
        className="w-full flex items-center justify-center gap-3 text-white font-semibold text-sm rounded-xl py-3.5 transition-all shadow-lg disabled:opacity-50 active:scale-[0.98]"
        style={{ backgroundColor: '#1877F2' }}
      >
        {fbLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="white">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )}
        {fbLoading ? 'Conectando...' : 'Continuar con Facebook'}
      </button>

      {/* Separador */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/25 text-xs uppercase tracking-widest">o con correo</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Formulario */}
      <form onSubmit={handleEmailLogin} className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            required
            autoComplete="email"
            disabled={busy}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-white/30 transition-all disabled:opacity-50"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
          <input
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Contraseña"
            required
            autoComplete="current-password"
            disabled={busy}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-11 py-3 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-white/30 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {error && <p className="text-red-400 text-xs text-center">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-red-700 hover:bg-red-600 active:scale-[0.98] text-white font-bold text-sm rounded-xl py-3.5 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Entrar al pueblo
        </button>
      </form>

      <p className="text-center text-white/30 text-xs pt-1">
        ¿Primera vez en el pueblo?{' '}
        <a href="/register" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors font-medium">
          Crear cuenta gratis
        </a>
      </p>
    </div>
  );
}
