import { RegisterForm } from '@/components/auth/RegisterForm';
import Image from 'next/image';
import Link from 'next/link';

export default function RegisterPage() {
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
            Tu papel<br />
            <span className="text-red-400">está a punto</span><br />
            de revelarse.
          </h2>
          <p className="text-white/40 text-lg leading-relaxed italic font-serif">
            "35 roles. Una noche. ¿Puedes sobrevivir?"
          </p>
        </div>

        <p className="text-white/20 text-xs">
          © 2025 El Pueblo Duerme · Juego gratis · Sin anuncios en partida
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
            <h2 className="text-2xl font-bold text-white font-headline">Unirte al pueblo</h2>
            <p className="text-white/40 text-sm mt-1">Crea tu cuenta gratis y empieza a jugar</p>
          </div>

          <RegisterForm />

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
