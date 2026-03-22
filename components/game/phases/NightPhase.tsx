'use client';

import { useState, useEffect } from 'react';
import { GameState, Player } from '@/lib/game/types';
import { ROLES, RoleId } from '@/lib/game/roles';
import { submitNightAction, submitWolfTarget, advanceNightRole } from '@/lib/game/engine';
import { Moon, Eye, Shield, Skull, Check, Heart, Users } from 'lucide-react';

interface Props {
  game: GameState; gameId: string; me: any; myRole: any; user: any;
  remaining: number; isHost: boolean;
}

function PlayerTarget({ players, onSelect, selected, excludeUids = [], label }: {
  players: Player[]; onSelect: (uid: string) => void;
  selected: string | null; excludeUids?: string[]; label?: string;
}) {
  const eligible = players.filter(p => p.isAlive && !excludeUids.includes(p.uid));
  return (
    <div className="w-full space-y-2">
      {label && <p className="text-white/50 text-xs text-center">{label}</p>}
      {eligible.map(p => (
        <button
          key={p.uid}
          onClick={() => onSelect(p.uid)}
          className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
            selected === p.uid ? 'bg-white/20 border-white/50' : 'bg-black/30 border-white/10 hover:border-white/30'
          }`}
        >
          <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
            {p.photoURL ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
              : <span className="w-full h-full flex items-center justify-center text-xs font-bold">{p.name[0]}</span>}
          </div>
          <span className="flex-1 text-left font-medium">{p.name}</span>
          {selected === p.uid && <Check className="h-4 w-4 text-green-400" />}
        </button>
      ))}
    </div>
  );
}

export function NightPhase({ game, gameId, me, myRole, user, remaining, isHost }: Props) {
  const [localRemaining, setLocalRemaining] = useState(remaining);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedTarget2, setSelectedTarget2] = useState<string | null>(null);
  const [witchAction, setWitchAction] = useState<'protect' | 'poison' | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const currentRole = game.currentNightRole;
  const myRoleId = me?.role as RoleId | undefined;
  const allPlayers = game.players ?? [];
  const alivePlayers = allPlayers.filter(p => p.isAlive);
  const isMyTurn = myRoleId === currentRole
    || (currentRole === 'lobo' && (myRoleId === 'cria_lobo' || me?.transformedToWolf));

  useEffect(() => {
    const start = game.phaseStartedAt;
    const dur = game.phaseDuration;
    const tick = () => setLocalRemaining(Math.max(0, dur - (Date.now() - start) / 1000));
    const iv = setInterval(tick, 500);
    return () => clearInterval(iv);
  }, [game.phaseStartedAt, game.phaseDuration]);

  // Reset state on role change
  useEffect(() => {
    setSelectedTarget(null);
    setSelectedTarget2(null);
    setWitchAction(null);
    setSubmitted(false);
  }, [currentRole]);

  const submitAction = async () => {
    if (!selectedTarget || submitting || !me) return;
    setSubmitting(true);

    if (myRoleId === 'lobo' || myRoleId === 'cria_lobo' || me?.transformedToWolf) {
      await submitWolfTarget(gameId, selectedTarget);
    } else {
      await submitNightAction(gameId, {
        uid: user.uid,
        action: witchAction ?? 'target',
        targetUid: selectedTarget,
        target2Uid: selectedTarget2 ?? undefined,
      });
    }
    setSubmitted(true);
    setSubmitting(false);
  };

  const currentRoleConfig = currentRole ? ROLES[currentRole] : null;

  // Wolves see each other
  const wolfTeam = alivePlayers.filter(p => p.role === 'lobo' || p.role === 'cria_lobo' || p.transformedToWolf);

  return (
    <div className="flex flex-col items-center justify-start h-full overflow-y-auto p-4 gap-4">
      {/* Night atmosphere */}
      <div className="text-center pt-4">
        <Moon className="h-8 w-8 text-indigo-400 mx-auto mb-2" />
        <h2 className="font-headline text-2xl font-bold text-indigo-300">La Noche</h2>
        <p className="text-white/30 text-sm">Ronda {game.round} · {Math.round(localRemaining)}s</p>
      </div>

      {/* Night order indicators */}
      <div className="flex gap-1 flex-wrap justify-center max-w-sm">
        {game.nightOrder.map((roleId, i) => {
          const role = ROLES[roleId];
          const isPast = i < game.nightOrderIndex;
          const isCurrent = i === game.nightOrderIndex;
          return (
            <div key={roleId} className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
              isCurrent ? 'bg-white text-black border-white font-bold' :
              isPast ? 'bg-white/10 border-white/5 text-white/20 line-through' :
              'bg-white/5 border-white/10 text-white/40'
            }`}>{role?.name ?? roleId}</div>
          );
        })}
      </div>

      {/* Current role is waking */}
      {currentRoleConfig && (
        <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-2xl p-4 text-center max-w-sm w-full">
          <p className="text-indigo-300/60 text-xs uppercase tracking-widest mb-1">Despertando...</p>
          <p className="text-white font-bold text-lg">{currentRoleConfig.name}</p>
          <p className="text-white/40 text-xs mt-1">Cumple tu misión en silencio</p>
        </div>
      )}

      {/* My turn - action panel */}
      {isMyTurn && !submitted && me?.isAlive && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 max-w-sm w-full">
          <p className="text-green-400 text-sm font-bold text-center mb-1">🌙 Es tu turno</p>
          <p className="text-white/60 text-xs text-center mb-4">{currentRoleConfig?.nightActionLabel}</p>

          {/* Wolf turn - show team members */}
          {(myRoleId === 'lobo' || myRoleId === 'cria_lobo' || me?.transformedToWolf) && (
            <>
              {wolfTeam.length > 1 && (
                <div className="mb-3 bg-red-900/20 border border-red-500/20 rounded-xl p-3">
                  <p className="text-red-300 text-xs text-center mb-2">🐺 Tu manada</p>
                  {wolfTeam.filter(p => p.uid !== user.uid).map(p => (
                    <div key={p.uid} className="flex items-center gap-2 py-1">
                      <div className="w-6 h-6 rounded-full overflow-hidden bg-white/10">
                        {p.photoURL ? <img src={p.photoURL} alt={p.name} className="w-full h-full object-cover" />
                          : <span className="w-full h-full flex items-center justify-center text-[10px] font-bold">{p.name[0]}</span>}
                      </div>
                      <span className="text-red-200 text-xs">{p.name}</span>
                      <span className="text-red-400/60 text-[10px]">({ROLES[p.role as RoleId]?.name})</span>
                    </div>
                  ))}
                </div>
              )}
              <PlayerTarget
                players={alivePlayers}
                excludeUids={wolfTeam.map(p => p.uid)}
                onSelect={setSelectedTarget}
                selected={selectedTarget}
                label="Elige una víctima"
              />
            </>
          )}

          {/* Vidente */}
          {myRoleId === 'vidente' && (
            <>
              <PlayerTarget players={alivePlayers} excludeUids={[user.uid]} onSelect={setSelectedTarget} selected={selectedTarget} label="Investiga a un jugador" />
              {selectedTarget && game.nightActions[user.uid] && (
                <div className="mt-3 bg-indigo-900/30 border border-indigo-500/30 rounded-xl p-3 text-center">
                  <p className="text-indigo-300 text-sm">Resultado de investigación disponible</p>
                </div>
              )}
            </>
          )}

          {/* Guardian / Sacerdote */}
          {(myRoleId === 'guardian' || myRoleId === 'sacerdote') && (
            <PlayerTarget
              players={alivePlayers}
              excludeUids={myRoleId === 'guardian' && game.guardianLastProtected ? [game.guardianLastProtected] : []}
              onSelect={setSelectedTarget} selected={selectedTarget}
              label={myRoleId === 'guardian' ? 'Protege a un jugador esta noche' : 'Bendice a un jugador'}
            />
          )}

          {/* Hechicera */}
          {myRoleId === 'hechicera' && (
            <>
              <div className="flex gap-2 mb-3">
                {game.witchPotions?.protect && (
                  <button onClick={() => setWitchAction('protect')} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${witchAction === 'protect' ? 'bg-blue-600 border-blue-500 text-white' : 'border-blue-500/30 text-blue-300 hover:bg-blue-900/20'}`}>
                    🧪 Poción de protección
                  </button>
                )}
                {game.witchPotions?.poison && (
                  <button onClick={() => setWitchAction('poison')} className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${witchAction === 'poison' ? 'bg-red-600 border-red-500 text-white' : 'border-red-500/30 text-red-300 hover:bg-red-900/20'}`}>
                    ☠️ Veneno
                  </button>
                )}
              </div>
              {witchAction && (
                <PlayerTarget players={alivePlayers} excludeUids={[]} onSelect={setSelectedTarget} selected={selectedTarget}
                  label={witchAction === 'protect' ? 'Elige a quién salvar' : 'Elige a quién envenenar'} />
              )}
              {!game.witchPotions?.protect && !game.witchPotions?.poison && (
                <p className="text-white/40 text-sm text-center">No te quedan pociones.</p>
              )}
            </>
          )}

          {/* Cupido */}
          {myRoleId === 'cupido' && (
            <>
              <PlayerTarget players={alivePlayers} excludeUids={selectedTarget2 ? [selectedTarget2] : []} onSelect={setSelectedTarget} selected={selectedTarget} label="Primer enamorado" />
              {selectedTarget && (
                <div className="mt-3">
                  <PlayerTarget players={alivePlayers} excludeUids={[selectedTarget]} onSelect={setSelectedTarget2} selected={selectedTarget2} label="Segundo enamorado" />
                </div>
              )}
            </>
          )}

          {/* Virginia Woolf, Cambiaformas, Silenciadora, Anciana Líder, Sirena, Alborotadora */}
          {['virginia_woolf', 'cambiaformas', 'silenciadora', 'anciana_lider', 'sirena_rio'].includes(myRoleId ?? '') && (
            <PlayerTarget players={alivePlayers} excludeUids={[user.uid]} onSelect={setSelectedTarget} selected={selectedTarget} />
          )}

          {myRoleId === 'alborotadora' && (
            <>
              <PlayerTarget players={alivePlayers} excludeUids={[user.uid, selectedTarget2 ?? '']} onSelect={setSelectedTarget} selected={selectedTarget} label="Primera víctima" />
              {selectedTarget && (
                <div className="mt-3">
                  <PlayerTarget players={alivePlayers} excludeUids={[user.uid, selectedTarget]} onSelect={setSelectedTarget2} selected={selectedTarget2} label="Segunda víctima" />
                </div>
              )}
            </>
          )}

          <button
            onClick={submitAction}
            disabled={!selectedTarget || submitting || (myRoleId === 'cupido' && !selectedTarget2) || (myRoleId === 'alborotadora' && !selectedTarget2) || (myRoleId === 'hechicera' && !witchAction)}
            className="mt-4 w-full bg-white text-black font-bold py-2.5 rounded-xl disabled:opacity-40 hover:bg-white/90 transition-colors"
          >
            {submitting ? 'Enviando...' : 'Confirmar acción'}
          </button>
        </div>
      )}

      {submitted && (
        <div className="bg-green-900/20 border border-green-500/20 rounded-2xl p-4 text-center max-w-sm w-full">
          <Check className="h-6 w-6 text-green-400 mx-auto mb-2" />
          <p className="text-green-300 font-medium">Acción enviada</p>
          <p className="text-white/30 text-xs mt-1">Esperando al resto...</p>
        </div>
      )}

      {!isMyTurn && me?.isAlive && (
        <div className="text-center">
          <p className="text-white/20 text-sm">Permanece dormido...</p>
          <p className="text-white/10 text-xs mt-1">No hagas ruido</p>
        </div>
      )}

      {!me?.isAlive && (
        <div className="text-center">
          <p className="text-white/20 text-sm italic">Observas desde el más allá...</p>
        </div>
      )}
    </div>
  );
}
