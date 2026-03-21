import { RegisterForm } from '@/components/auth/RegisterForm';
import Image from 'next/image';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4">
      <Image src="/noche.png" alt="Fondo" fill className="object-cover z-0 brightness-50" priority />
      <div className="absolute inset-0 bg-background/70 z-[1]" />
      <div className="absolute top-4 left-4 z-10">
        <Link href="/" className="text-white/60 hover:text-white transition-colors text-sm">
          ← Volver al Inicio
        </Link>
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <Image src="/logo.png" alt="Logo" width={80} height={80} className="mx-auto mb-4 drop-shadow-xl" />
          </Link>
          <h1 className="font-headline text-3xl font-bold text-white">Únete al Pueblo</h1>
          <p className="text-white/50 mt-1">Crea tu cuenta gratis y empieza a jugar</p>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
