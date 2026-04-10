import { LoginForm } from '@/components/auth/LoginForm';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div
      className="relative min-h-screen w-full flex"
      style={{
        backgroundImage: 'url(/noche.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-black/75" />

      {/* Panel izquierdo — Identidad */}
      <div className="relative z-10 hidden lg:flex flex-col justify-between flex-1 p-12">
        <Link href="/">
          <Image src="/logo.png" alt="Logo" width={64} height={64} className="rounded-full drop-shadow-xl" />
        </Link>

        <div className="max-w-md">
          <p className="text-red-400/70 text-xs uppercase tracking-[0.3em] mb-4 font-mono">El Pueblo Duerme</p>
          <h2 className="text-5xl font-bold text-white font-headline leading-tight mb-6">
            Entre vosotros<br />
            <span className="text-red-400">se esconde</span><br />
            un lobo.
          </h2>
          <p className="text-white/40 text-lg leading-relaxed italic font-serif">
            "La IA lo sabe. El pueblo no."
          </p>
        </div>

        <p className="text-white/20 text-xs">
          © 2025 El Pueblo Duerme · 35 roles · Narradora IA · Chat de voz
        </p>
      </div>

      {/* Panel derecho — Formulario */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full lg:w-[480px] lg:min-w-[480px] min-h-screen px-8 py-12 bg-black/60 lg:bg-black/50 backdrop-blur-sm border-l border-white/5">

        {/* Logo mobile */}
        <div className="lg:hidden mb-8 text-center">
          <Link href="/">
            <Image src="/logo.png" alt="Logo" width={72} height={72} className="mx-auto rounded-full drop-shadow-xl mb-3" />
          </Link>
          <h1 className="font-headline text-2xl font-bold text-white">El Pueblo Duerme</h1>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white font-headline">Entrar al pueblo</h2>
            <p className="text-white/40 text-sm mt-1">Inicia sesión para unirte a la partida</p>
          </div>

          <LoginForm />

          <div className="mt-8 text-center">
            <Link href="/" className="text-white/25 hover:text-white/50 text-xs transition-colors">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
