import { RegisterForm } from '@/components/auth/RegisterForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function RegisterPage() {
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
            <CardTitle className="text-2xl font-bold text-white">Únete al Pueblo</CardTitle>
            <CardDescription className="text-gray-300">Crea tu cuenta para empezar a jugar.</CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
