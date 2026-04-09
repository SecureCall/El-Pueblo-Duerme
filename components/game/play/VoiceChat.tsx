'use client';

import { useVoiceChat } from '@/hooks/useVoiceChat';
import { Mic, MicOff, WifiOff, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface Props {
  gameId: string;
  userId: string;
  userName: string;
  phase: string;
  myRole: string;
  isAlive: boolean;
  wolfTeam?: Record<string, boolean>;
}

const WOLF_ROLES = new Set(['Lobo', 'Alfa', 'Lobo Solitario', 'Hechicera', 'Lobo Anciano', 'Lobo Blanco', 'Cría de Lobo', 'Virginia Woolf']);

export function VoiceChat({ gameId, userId, userName, phase, myRole, isAlive, wolfTeam = {} }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const isWolf = WOLF_ROLES.has(myRole) || wolfTeam[userId];
  const isDead = !isAlive;

  let channel: string;
  let canSpeak: boolean;

  if (phase === 'night') {
    if (isWolf && isAlive) {
      channel = 'wolves';
      canSpeak = true;
    } else if (isDead) {
      channel = 'ghost';
      canSpeak = false;
    } else {
      channel = 'silent';
      canSpeak = false;
    }
  } else {
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
  const speakingNow = peers.find(p => p.speaking);

  const CHANNEL_CFG = {
    wolves: { label: '🐺 Canal Lobos',    border: 'border-red-700/60',    bg: 'bg-red-950/80',    dot: 'bg-red-500' },
    ghost:  { label: '👻 Solo escuchas',   border: 'border-purple-700/60', bg: 'bg-purple-950/80', dot: 'bg-purple-500' },
    main:   { label: '🎙️ Chat de Voz',     border: 'border-blue-700/60',   bg: 'bg-blue-950/80',   dot: 'bg-blue-400' },
  } as const;

  const cfg = CHANNEL_CFG[channel as keyof typeof CHANNEL_CFG] ?? CHANNEL_CFG.main;

  // Si no tiene permiso de micrófono y puede hablar → botón de activación más prominente
  if (canSpeak && !permissionGranted && !error) {
    return (
      <div className="fixed bottom-20 left-3 z-50">
        <button
          onClick={toggleMute}
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl border ${cfg.border} ${cfg.bg} backdrop-blur-sm shadow-xl text-white text-xs font-semibold animate-pulse`}
        >
          <Mic className="h-3.5 w-3.5 text-white/70" />
          <span>Unirte con voz</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-20 left-3 z-50 w-48 rounded-2xl border ${cfg.border} ${cfg.bg} backdrop-blur-md shadow-2xl`}>

      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-3 py-2 text-white hover:bg-white/5 rounded-t-2xl transition-colors"
      >
        <div className="flex items-center gap-2">
          {/* Indicador de estado */}
          <div className={`w-2 h-2 rounded-full ${cfg.dot} ${speakingNow ? 'animate-ping' : 'opacity-60'}`} />
          <span className="text-[11px] font-semibold">{cfg.label}</span>
        </div>
        {collapsed
          ? <ChevronUp className="h-3 w-3 text-white/40" />
          : <ChevronDown className="h-3 w-3 text-white/40" />
        }
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/10">

          {/* Error de micrófono */}
          {error && (
            <p className="text-red-400 text-[10px] pt-2 text-center">{error}</p>
          )}

          {/* Conectando */}
          {connecting && !error && (
            <div className="flex items-center gap-1.5 text-white/50 text-[10px] pt-2">
              <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce" />
              Conectando…
            </div>
          )}

          {/* Tu micrófono */}
          {canSpeak && permissionGranted && (
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] ${!isMuted ? 'ring-1 ring-green-400' : ''}`}>
                  🧑
                </div>
                <span className="text-[11px] text-white/80 truncate max-w-[70px]">Tú</span>
              </div>
              <button
                onClick={toggleMute}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shadow ${
                  isMuted ? 'bg-red-700 hover:bg-red-600' : 'bg-green-700 hover:bg-green-600'
                }`}
                title={isMuted ? 'Activar micrófono' : 'Silenciar'}
              >
                {isMuted
                  ? <MicOff className="h-3 w-3 text-white" />
                  : <Mic className="h-3 w-3 text-white" />
                }
              </button>
            </div>
          )}

          {/* Solo escucha (muerto) */}
          {!canSpeak && permissionGranted && (
            <p className="text-white/30 text-[10px] pt-2">👂 Solo escuchas</p>
          )}

          {/* Lista de compañeros */}
          {peers.length > 0 && (
            <div className="space-y-1.5 border-t border-white/10 pt-2">
              {peers.map(peer => (
                <div key={peer.uid} className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center bg-white/10 text-[10px] ${peer.speaking ? 'ring-1 ring-green-400 animate-pulse' : ''}`}>
                    {peer.speaking ? '🔊' : peer.connected ? '🔈' : '⏳'}
                  </div>
                  <span className="text-[11px] text-white/70 truncate flex-1">{peer.name}</span>
                  {!peer.connected && (
                    <WifiOff className="h-2.5 w-2.5 text-white/30 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Nadie más */}
          {peers.length === 0 && !connecting && permissionGranted && (
            <p className="text-white/25 text-[10px] pt-1">Nadie más en el canal</p>
          )}

          {/* Pie de estado */}
          <div className="flex items-center gap-1 text-[9px] text-white/20 pt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${connectedPeers.length > 0 ? 'bg-green-500/60' : 'bg-white/20'}`} />
            {connectedPeers.length} conectado{connectedPeers.length !== 1 ? 's' : ''}
            {speakingNow && (
              <span className="text-green-400/60 ml-1">· {speakingNow.name} habla</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
