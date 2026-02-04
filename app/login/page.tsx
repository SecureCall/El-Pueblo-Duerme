import { LoginForm } from '@/components/auth/LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 to-purple-950">
      <div className="absolute top-4 left-4 z-10">
        <Link href="/" className="text-white hover:text-blue-400 transition-colors">
          &larr; Volver al Inicio
        </Link>
      </div>
      
      <div className="w-full max-w-md">
        <Card className="bg-gray-800/80 border-gray-700">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white">¡Bienvenido de vuelta!</CardTitle>
            <CardDescription className="text-gray-300">Inicia sesión para entrar al pueblo.</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
