"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

const formSchema = z.object({
  displayName: z.string().min(3, { message: 'Mínimo 3 caracteres.' }).max(20, { message: 'Máximo 20 caracteres.' }),
  email: z.string().email({ message: 'Email inválido.' }),
  password: z.string().min(6, { message: 'Mínimo 6 caracteres.' }),
});

export function RegisterForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const errors = form.formState.errors;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, values.email, values.password);
      if (cred.user) await updateProfile(cred.user, { displayName: values.displayName });
      router.push('/');
      router.refresh();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al registrarse',
        description: error.code === 'auth/email-already-in-use'
          ? 'Este email ya tiene una cuenta. Inicia sesión.'
          : 'Inténtalo de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      router.push('/');
      router.refresh();
    } catch {
      toast({ variant: 'destructive', title: 'Error con Google', description: 'No se pudo iniciar sesión.' });
    } finally {
      setIsGoogleLoading(false);
    }
  }

  const busy = isLoading || isGoogleLoading;

  return (
    <div className="space-y-5">

      {/* Google — acceso rápido */}
      <button
        onClick={handleGoogleSignIn}
        disabled={busy}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 active:scale-[0.98] text-gray-900 font-semibold text-sm rounded-xl py-3.5 transition-all shadow-lg disabled:opacity-50"
      >
        {isGoogleLoading
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : (
            <svg className="h-5 w-5" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
          )
        }
        Registrarse con Google
      </button>

      {/* Separador */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/25 text-xs uppercase tracking-widest">o con correo</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Formulario */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

        {/* Nombre */}
        <div>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
            <input
              type="text"
              autoComplete="nickname"
              placeholder="Tu nombre en el juego"
              {...form.register('displayName')}
              disabled={busy}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-white/30 transition-all disabled:opacity-50"
            />
          </div>
          {errors.displayName && <p className="text-red-400 text-xs mt-1 ml-1">{errors.displayName.message}</p>}
        </div>

        {/* Email */}
        <div>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
            <input
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              {...form.register('email')}
              disabled={busy}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-white/30 transition-all disabled:opacity-50"
            />
          </div>
          {errors.email && <p className="text-red-400 text-xs mt-1 ml-1">{errors.email.message}</p>}
        </div>

        {/* Contraseña */}
        <div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
            <input
              type={showPass ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Contraseña (mín. 6 caracteres)"
              {...form.register('password')}
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
          {errors.password && <p className="text-red-400 text-xs mt-1 ml-1">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-red-700 hover:bg-red-600 active:scale-[0.98] text-white font-bold text-sm rounded-xl py-3.5 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 disabled:opacity-50 mt-1"
        >
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          Unirme al pueblo
        </button>
      </form>

      {/* Login */}
      <p className="text-center text-white/30 text-xs pt-1">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-white/60 hover:text-white underline underline-offset-2 transition-colors font-medium">
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
