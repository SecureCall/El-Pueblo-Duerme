import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4">
       <Image
          src="/noche.png"
          alt="A mysterious, dark, misty forest at night."
          fill
          className="object-cover z-0"
          priority
        />
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
         <div className="absolute top-4 left-4 z-10">
            <Link href="/" className="text-white hover:text-primary transition-colors">
                &larr; Volver al Inicio
            </Link>
        </div>
      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-card/90 border-border/60">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">¡Bienvenido de vuelta!</CardTitle>
            <CardDescription>Inicia sesión para entrar al pueblo.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
