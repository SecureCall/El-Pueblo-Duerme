'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthProvider';
import { auth, db } from '@/lib/firebase/config';
import {
  deleteUser,
  GoogleAuthProvider,
  reauthenticateWithPopup,
} from 'firebase/auth';
import {
  doc,
  deleteDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { Trash2, AlertTriangle, CheckCircle, LogIn } from 'lucide-react';

type Phase = 'info' | 'confirm' | 'deleting' | 'done' | 'error';

async function deleteAllUserData(uid: string) {
  const batch = writeBatch(db);

  const subcollections = ['coinHistory', 'purchases', 'gameHistory'];
  for (const sub of subcollections) {
    const snap = await getDocs(collection(db, 'users', uid, sub));
    snap.forEach(d => batch.delete(d.ref));
  }

  batch.delete(doc(db, 'users', uid));
  batch.delete(doc(db, 'playerBehavior', uid));

  try {
    const notifSnap = await getDocs(collection(db, 'pushSubscriptions', uid, 'devices'));
    notifSnap.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'pushSubscriptions', uid));
  } catch { /* optional collection */ }

  await batch.commit();
}

export default function DeleteAccountPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('info');
  const [errorMsg, setErrorMsg] = useState('');

  const handleDelete = async () => {
    if (!user) return;
    setPhase('deleting');
    try {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(user, provider);
      await deleteAllUserData(user.uid);
      await deleteUser(user);
      setPhase('done');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Error desconocido.');
      setPhase('error');
    }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 flex items-start justify-center px-4 py-12">
      <div className="max-w-xl w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors mb-8 text-sm"
        >
          ← Volver al inicio
        </Link>

        <h1 className="text-3xl font-bold text-red-400 mb-2 font-serif flex items-center gap-3">
          <Trash2 className="h-7 w-7" />
          Eliminar mi cuenta
        </h1>
        <p className="text-stone-400 text-sm mb-8">El Pueblo Duerme — gestión de datos de usuario</p>

        {phase === 'info' && (
          <div className="space-y-6">
            <div className="bg-red-950/40 border border-red-700/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3 text-red-400 font-semibold">
                <AlertTriangle className="h-5 w-5" />
                Esto eliminará permanentemente:
              </div>
              <ul className="space-y-2 text-stone-300 text-sm list-disc pl-5">
                <li>Tu perfil (nombre, foto, nivel, XP)</li>
                <li>Historial de partidas y estadísticas</li>
                <li>Monedas y compras en la tienda</li>
                <li>Suscripciones a notificaciones push</li>
                <li>Tu cuenta de autenticación (Firebase Auth)</li>
              </ul>
            </div>

            <div className="bg-stone-900 border border-stone-700 rounded-2xl p-5 text-sm text-stone-400 space-y-2">
              <p><strong className="text-stone-200">Datos retenidos temporalmente:</strong> Los registros técnicos anónimos (logs de errores sin identificador personal) se conservan hasta 30 días por razones de seguridad.</p>
              <p><strong className="text-stone-200">Partidas activas:</strong> Los mensajes enviados en partidas que ya finalizaron pueden permanecer en el historial de esa sala hasta que la partida expire (máx. 7 días).</p>
            </div>

            {!user ? (
              <div className="bg-stone-900 border border-amber-700/40 rounded-2xl p-5 text-center space-y-3">
                <p className="text-stone-300">Debes iniciar sesión para eliminar tu cuenta.</p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 px-6 rounded-xl transition-all"
                >
                  <LogIn className="h-4 w-4" />
                  Iniciar sesión
                </Link>
              </div>
            ) : (
              <button
                onClick={() => setPhase('confirm')}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-all active:scale-95"
              >
                Quiero eliminar mi cuenta
              </button>
            )}
          </div>
        )}

        {phase === 'confirm' && (
          <div className="space-y-5">
            <div className="bg-red-950/60 border border-red-500/60 rounded-2xl p-6 text-center space-y-3">
              <AlertTriangle className="h-10 w-10 text-red-400 mx-auto" />
              <p className="text-white font-bold text-lg">¿Estás completamente seguro?</p>
              <p className="text-stone-400 text-sm">
                Se te pedirá que confirmes con tu cuenta de Google. Esta acción <strong className="text-red-400">no se puede deshacer</strong>.
              </p>
            </div>
            <button
              onClick={handleDelete}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-all active:scale-95"
            >
              Sí, eliminar mi cuenta definitivamente
            </button>
            <button
              onClick={() => setPhase('info')}
              className="w-full bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold py-3 rounded-xl transition-all"
            >
              Cancelar
            </button>
          </div>
        )}

        {phase === 'deleting' && (
          <div className="text-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent mx-auto" />
            <p className="text-stone-400">Eliminando todos tus datos...</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center py-12 space-y-4">
            <CheckCircle className="h-14 w-14 text-green-400 mx-auto" />
            <p className="text-white font-bold text-xl">Cuenta eliminada</p>
            <p className="text-stone-400 text-sm">Todos tus datos han sido borrados permanentemente.</p>
            <Link
              href="/"
              className="inline-block mt-4 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 px-6 rounded-xl transition-all"
            >
              Volver al inicio
            </Link>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4">
            <div className="bg-red-950/40 border border-red-700/40 rounded-2xl p-5 text-center">
              <AlertTriangle className="h-10 w-10 text-red-400 mx-auto mb-3" />
              <p className="text-white font-bold">Ocurrió un error</p>
              <p className="text-stone-400 text-sm mt-1">{errorMsg}</p>
            </div>
            <button
              onClick={() => setPhase('info')}
              className="w-full bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold py-3 rounded-xl transition-all"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        <div className="mt-12 pt-6 border-t border-stone-800 flex flex-wrap gap-6 text-sm text-stone-500">
          <Link href="/privacy-policy" className="hover:text-amber-400 transition-colors">Política de Privacidad</Link>
          <Link href="/" className="hover:text-amber-400 transition-colors">Inicio</Link>
        </div>
      </div>
    </div>
  );
}
