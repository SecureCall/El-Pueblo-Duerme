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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToInvites(user.uid, (incoming) => {
      setInvites(incoming);
      // Auto-open tray when a new invite arrives
      if (incoming.length > 0) setOpen(true);
    });
  }, [user]);

  if (!user) return null;

  return (
    <>
      {/* ── Bell button (always visible when there are invites) ── */}
      {invites.length > 0 && !open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-4 z-50 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-400 text-black rounded-full w-14 h-14 flex items-center justify-center shadow-2xl shadow-yellow-900/60 animate-bounce"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          <Bell className="h-6 w-6" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {invites.length}
          </span>
        </button>
      )}

      {/* ── Invite tray ── */}
      {open && invites.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-start sm:items-end sm:flex-row pointer-events-none"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
        >
          {/* Backdrop (mobile full-screen tap to close) */}
          <div
            className="absolute inset-0 bg-black/40 sm:hidden pointer-events-auto"
            onClick={() => setOpen(false)}
          />

          {/* Cards container */}
          <div className="relative pointer-events-auto w-full sm:w-auto sm:max-w-sm sm:m-4 sm:mb-6 flex flex-col gap-3 p-4 sm:p-0">
            <div className="flex items-center justify-between mb-1 sm:hidden">
              <span className="text-white font-bold text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-yellow-400" />
                Invitaciones ({invites.length})
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-white/60 p-1 rounded-lg active:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {invites.slice(0, 5).map((inv) => (
              <div
                key={inv.id}
                className="bg-[#0d1117] border border-yellow-500/40 rounded-2xl shadow-2xl p-4 w-full"
              >
                <div className="flex items-start gap-3">
                  <div className="bg-yellow-500/20 rounded-xl p-2.5 flex-shrink-0">
                    <Swords className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">¡Te han invitado a jugar!</p>
                    <p className="text-white/60 text-xs mt-0.5">
                      <span className="text-white/90 font-semibold">{inv.hostName}</span>
                      {' '}te invita a{' '}
                      <span className="text-yellow-300 font-mono font-bold">{inv.gameCode}</span>
                    </p>
                    {inv.gameName && inv.gameName !== 'Partida' && (
                      <p className="text-white/40 text-xs mt-0.5 truncate">"{inv.gameName}"</p>
                    )}
                  </div>
                  <button
                    onClick={() => dismissInvite(user.uid, inv.id)}
                    className="text-white/30 hover:text-white/70 active:text-white/70 flex-shrink-0 p-1 rounded-lg transition-colors"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={async () => {
                      await dismissInvite(user.uid, inv.id);
                      setOpen(false);
                      router.push(`/game/${inv.gameId}`);
                    }}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-400 text-black font-bold text-sm py-3 rounded-xl transition-all shadow-lg shadow-yellow-900/40"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    🎮 Unirse ahora
                  </button>
                  <button
                    onClick={() => dismissInvite(user.uid, inv.id)}
                    className="flex-1 bg-white/10 hover:bg-white/20 active:bg-white/20 text-white/70 text-sm py-3 rounded-xl transition-all"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
