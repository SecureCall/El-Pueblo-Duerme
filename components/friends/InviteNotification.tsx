'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { GameInvite, subscribeToInvites, dismissInvite } from '@/lib/firebase/friends';
import { useRouter } from 'next/navigation';
import { Bell, X, Swords } from 'lucide-react';

export function InviteNotification() {
  const { user } = useAuth();
  const router = useRouter();
  const [invites, setInvites] = useState<GameInvite[]>([]);

  useEffect(() => {
    if (!user) return;
    return subscribeToInvites(user.uid, setInvites);
  }, [user]);

  if (!user || invites.length === 0) return null;

  const latest = invites[0];

  const handleAccept = async () => {
    await dismissInvite(user.uid, latest.id);
    router.push(`/game/${latest.gameId}`);
  };

  const handleDismiss = async () => {
    await dismissInvite(user.uid, latest.id);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {invites.slice(0, 3).map((inv, i) => (
        <div
          key={inv.id}
          className="bg-[#0d1117] border border-yellow-500/40 rounded-xl shadow-2xl p-4 w-72 animate-in slide-in-from-right-4"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="flex items-start gap-3">
            <div className="bg-yellow-500/20 rounded-lg p-2 flex-shrink-0">
              <Swords className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">¡Te han invitado!</p>
              <p className="text-white/60 text-xs mt-0.5 truncate">
                <span className="text-white/80">{inv.hostName}</span> te invita a <span className="text-yellow-400 font-mono">{inv.gameCode}</span>
              </p>
            </div>
            <button onClick={() => dismissInvite(user.uid, inv.id)} className="text-white/30 hover:text-white/70 flex-shrink-0 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={async () => { await dismissInvite(user.uid, inv.id); router.push(`/game/${inv.gameId}`); }}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs py-2 rounded-lg transition-all"
            >
              Unirse
            </button>
            <button
              onClick={() => dismissInvite(user.uid, inv.id)}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white/70 text-xs py-2 rounded-lg transition-all"
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
