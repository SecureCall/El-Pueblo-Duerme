'use client';

import { useVoiceChat, PeerState } from '@/hooks/useVoiceChat';
import { Mic, MicOff, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react';
import { useState } from 'react';

interface Props {
  gameId: string;
  userId: string;
  userName: string;
  phase: string;          // 'day' | 'night'
  myRole: string;
  isAlive: boolean;
  wolfTeam?: Record<string, boolean>;
}

const WOLF_ROLES = new Set(['Lobo', 'Alfa', 'Lobo Solitario', 'Hechicera', 'Lobo Anciano', 'Lobo Blanco', 'Cría de Lobo', 'Virginia Woolf']);

function speakingRing(speaking: boolean) {
  return speaking ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-black animate-pulse' : '';
}

export function VoiceChat({ gameId, userId, userName, phase, myRole, isAlive, wolfTeam = {} }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const isWolf = WOLF_ROLES.has(myRole) || wolfTeam[userId];
  const isDead = !isAlive;

  // Determinar canal y permisos de habla
  let channel: string;
  let canSpeak: boolean;

  if (phase === 'night') {
    if (isWolf && isAlive) {
      channel = 'wolves';
      canSpeak = true;
    } else if (isDead) {
      channel = 'ghost';
      canSpeak = false; // muertos solo escuchan
    } else {
      // Aldeanos vivos de noche no tienen voz (están durmiendo)
      channel = 'silent';
      canSpeak = false;
    }
  } else {
    // Día
    if (isAlive) {
      channel = 'main';
      canSpeak = true;
    } else {
      channel = 'ghost';
      canSpeak = false;
    }
  }

  const enabled = channel !== 'silent';

  const { isMuted, toggleMute, peers, permissionGranted, connecting, error } = useVoiceChat({
    gameId,
    userId,
    userName,
    channel,
    canSpeak,
    enabled,
  });

  if (channel === 'silent') return null;

  const connectedPeers = peers.filter(p => p.connected);
  const speakingPeers = peers.filter(p => p.speaking);

  const channelLabel = channel === 'wolves'
    ? '🐺 Canal Lobos'
    : channel === 'ghost'
      ? '👻 Canal Fantasmas'
      : '🎙️ Canal del Pueblo';

  const channelColor = channel === 'wolves'
    ? 'border-red-800/50 bg-red-950/40'
    : channel === 'ghost'
      ? 'border-purple-800/50 bg-purple-950/40'
      : 'border-blue-800/50 bg-blue-950/40';

  return (
    <div className={`fixed bottom-20 left-3 z-50 w-52 rounded-2xl border ${channelColor} backdrop-blur-sm shadow-xl`}>

      {/* Header con toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-3 py-2 text-white/80 hover:text-white transition-colors"
      >
        <span className="text-xs font-semibold">{channelLabel}</span>
        <span className="text-[10px] text-white/40">{collapsed ? '▲' : '▼'}</span>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2">

          {/* Error */}
          {error && (
            <p className="text-red-400 text-[10px] text-center">{error}</p>
          )}

          {/* Connecting */}
          {connecting && !error && (
            <div className="flex items-center gap-1.5 text-white/50 text-[10px]">
              <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" />
              Conectando…
            </div>
          )}

          {/* Mi micrófono */}
          {canSpeak && permissionGranted && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full bg-blue-800/60 flex items-center justify-center ${!isMuted ? speakingRing(true) : ''}`}>
                  <span className="text-[10px]">🧑</span>
                </div>
                <span className="text-[11px] text-white/70 truncate max-w-[80px]">{userName}</span>
              </div>
              <button
                onClick={toggleMute}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-700 hover:bg-red-600' : 'bg-green-700 hover:bg-green-600'}`}
                title={isMuted ? 'Activar micrófono' : 'Silenciar'}
              >
                {isMuted ? <MicOff className="h-3 w-3 text-white" /> : <Mic className="h-3 w-3 text-white" />}
              </button>
            </div>
          )}

          {/* Botón para permitir micrófono */}
          {canSpeak && !permissionGranted && !error && (
            <button
              onClick={toggleMute}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-600 rounded-xl py-2 text-xs text-white transition-colors"
            >
              <Mic className="h-3 w-3" />
              Unirse con micrófono
            </button>
          )}

          {/* Solo escucha */}
          {!canSpeak && (
            <div className="flex items-center gap-1.5 text-white/40 text-[10px]">
              <VolumeX className="h-3 w-3" />
              Solo escuchas
            </div>
          )}

          {/* Separador */}
          {peers.length > 0 && <div className="border-t border-white/10" />}

          {/* Lista de peers */}
          {peers.length === 0 && !connecting && (
            <p className="text-white/30 text-[10px] text-center">Nadie más en el canal</p>
          )}

          {peers.map(peer => (
            <div key={peer.uid} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-white/10 ${speakingRing(peer.speaking)}`}>
                {peer.speaking ? '🔊' : peer.connected ? '🔈' : '⏳'}
              </div>
              <span className="text-[11px] text-white/70 truncate flex-1">{peer.name}</span>
              {!peer.connected && (
                <WifiOff className="h-2.5 w-2.5 text-white/30 flex-shrink-0" />
              )}
            </div>
          ))}

          {/* Indicador canal activo */}
          <div className="flex items-center gap-1 text-[9px] text-white/20 mt-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/50 animate-pulse" />
            {connectedPeers.length} conectado{connectedPeers.length !== 1 ? 's' : ''}
            {speakingPeers.length > 0 && (
              <span className="text-green-400/70 ml-1">· {speakingPeers[0].name} habla</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
