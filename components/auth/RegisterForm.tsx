'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      alert('Las contraseñas no coinciden');
      return;
    }
    
    setLoading(true);
    
    // Simulación temporal
    console.log('Register attempt:', { email, password });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Redirigir al login
    router.push('/login');
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Correo Electrónico
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
          className="w-full p-2 border rounded bg-background"
          disabled={loading}
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full p-2 border rounded bg-background"
          disabled={loading}
        />
      </div>
      
      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium">
          Confirmar Contraseña
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
          className="w-full p-2 border rounded bg-background"
          disabled={loading}
        />
      </div>
      
      <button
        type="submit"
        disabled={loading}
        className="w-full p-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
      </button>
      
      <div className="text-center text-sm">
        <p>¿Ya tienes cuenta? 
          <a href="/login" className="text-primary hover:underline ml-1">
            Inicia sesión
          </a>
        </p>
      </div>
    </form>
  );
}
