'use client';

import { useState, useEffect, useRef } from 'react';
import { ROLES } from './roles';
import { GameState, Player } from './GamePlay';
import { Moon, Send, Bot, Eye, Shield, Skull, Heart, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

interface Props {
  game: GameState;
  gameId: string;
  myRole: string;
  me?: Player;
  userId: string;
  isHost: boolean;
  onSubmitAction: (action: Record<string, unknown>) => Promise<void>;
}

export function NightPhase({ game, gameId, myRole, me, userId, isHost, onSubmitAction }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [witchChoice, setWitchChoice] = useState<'save' | 'poison' | 'pass' | null>(null);
  const [cupidTargets, setCupidTargets] = useState<string[]>([]);
  const [wolfMsg, setWolfMsg] = useState('');
  const [wolfMsgs, setWolfMsgs] = useState<{ id: string; name: string; text: string }[]>([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const subs = game.nightSubmissions ?? {};

  const alivePlayers = (game.players ?? []).filter(p => p.isAlive && p.uid !== userId);
  const isWolf = myRole === 'Lobo';
  const isSeer = myRole === 'Vidente';
  const isWitch = myRole === 'Bruja';
  const isCupido = myRole === 'Cupido' && (game.roundNumber ?? 1) === 1;
  const isNightRole = isWolf || isSeer || isWitch || isCupido;

  const wolfTarget = game.nightActions?.wolfTarget;
  const victim = wolfTarget ? game.players?.find(p => p.uid === wolfTarget) : null;

  useEffect(() => {
    if (!isWolf) return;
    const q = query(collection(db, 'games', gameId, 'wolfChat'), orderBy('createdAt', 'asc'), limit(50));
    const unsub = onSnapshot(q, snap => {
      setWolfMsgs(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
      setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  }, [isWolf, gameId]);

  const handleSubmit = async () => {
    if (submitted) return;
    const action: Record<string, unknown> = {};

    if (isWolf && selectedTarget) action.wolfTarget = selectedTarget;
    if (isSeer && selectedTarget) action.seerTarget = selectedTarget;
    if (isWitch) {
      if (witchChoice === 'save') action.witchSave = true;
      if (witchChoice === 'poison' && selectedTarget) action.witchPoison = selectedTarget;
    }
    if (isCupido && cupidTargets.length === 2) action.cupidTargets = cupidTargets;
    if (!isNightRole) {
      action._skip = true;
    }

    await onSubmitAction(action);
    setSubmitted(true);
  };

  const handleAutoSkip = async () => {
    await onSubmitAction({ _skip: true });
    setSubmitted(true);
  };

  const sendWolfMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wolfMsg.trim() || !isWolf) return;
    setSendingMsg(true);
    await addDoc(collection(db, 'games', gameId, 'wolfChat'), {
      name: me?.name ?? 'Lobo',
      text: wolfMsg.trim(),
      createdAt: serverTimestamp(),
    });
    setWolfMsg('');
    setSendingMsg(false);
  };

  const toggleCupidTarget = (uid: string) => {
    setCupidTargets(prev => {
      if (prev.includes(uid)) return prev.filter(u => u !== uid);
      if (prev.length >= 2) return [prev[1], uid];
      return [...prev, uid];
    });
  };

  return (
    <div
      className="min-h-screen w-full text-white"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0 bg-black/88" />
      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Moon className="h-6 w-6 text-blue-400" />
          <h1 className="font-headline text-2xl font-bold">Noche {game.roundNumber ?? 1}</h1>
        </div>
        <p className="text-white/40 text-sm mb-8">El pueblo duerme. Las sombras actúan...</p>

        <div className="w-full max-w-lg space-y-4">

          {/* Already submitted overlay */}
          {submitted && (
            <div className="text-center py-8 bg-black/40 border border-white/10 rounded-2xl">
              <Loader2 className="h-8 w-8 animate-spin text-white/40 mx-auto mb-3" />
              <p className="text-white/60">Has actuado. Esperando a los demás...</p>
            </div>
          )}

          {/* WOLVES */}
          {isWolf && !submitted && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Skull className="h-5 w-5 text-red-400" />
                <h3 className="font-semibold text-red-300">Elegid vuestra presa</h3>
              </div>

              <div className="space-y-2 mb-4">
                {alivePlayers.filter(p => game.roles?.[p.uid] !== 'Lobo').map(p => (
                  <button
                    key={p.uid}
                    onClick={() => setSelectedTarget(p.uid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedTarget === p.uid ? 'border-red-500 bg-red-900/30' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full rounded-full object-cover" /> : p.name[0]}
                    </div>
                    <span className="font-medium">{p.name}</span>
                    {p.isAI && <Bot className="h-3.5 w-3.5 text-cyan-400 ml-auto" />}
                  </button>
                ))}
              </div>

              {/* Wolf chat */}
              <div className="bg-black/40 rounded-xl mb-3 overflow-hidden">
                <p className="text-red-400/60 text-xs px-3 pt-2 pb-1 uppercase tracking-wide">Chat de lobos</p>
                <div ref={chatRef} className="h-24 overflow-y-auto px-3 pb-2 space-y-1">
                  {wolfMsgs.map(m => (
                    <p key={m.id} className="text-xs text-white/70"><span className="text-red-400 font-medium">{m.name}:</span> {m.text}</p>
                  ))}
                </div>
                <form onSubmit={sendWolfMsg} className="flex gap-2 p-2 border-t border-white/5">
                  <input
                    value={wolfMsg}
                    onChange={e => setWolfMsg(e.target.value)}
                    placeholder="Hablar con tu manada..."
                    className="flex-1 bg-transparent text-xs text-white placeholder:text-white/30 outline-none"
                    maxLength={150}
                  />
                  <button type="submit" disabled={!wolfMsg.trim() || sendingMsg} className="text-red-400 hover:text-red-300 disabled:opacity-30">
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!selectedTarget}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
              >
                Confirmar víctima
              </button>
            </div>
          )}

          {/* SEER */}
          {isSeer && !submitted && (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-5 w-5 text-purple-400" />
                <h3 className="font-semibold text-purple-300">¿A quién investigas esta noche?</h3>
              </div>

              {game.seerReveal && (
                <div className={`mb-4 p-3 rounded-xl text-sm ${game.seerReveal.isWolf ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}>
                  Noche anterior: {game.players?.find(p => p.uid === game.seerReveal?.targetUid)?.name} es {game.seerReveal.isWolf ? '🐺 un LOBO' : '🌾 inocente'}
                </div>
              )}

              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => (
                  <button
                    key={p.uid}
                    onClick={() => setSelectedTarget(p.uid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedTarget === p.uid ? 'border-purple-500 bg-purple-900/30' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full rounded-full object-cover" /> : p.name[0]}
                    </div>
                    <span className="font-medium">{p.name}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={handleSubmit}
                disabled={!selectedTarget}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
              >
                Usar visión
              </button>
            </div>
          )}

          {/* WITCH */}
          {isWitch && !submitted && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-green-400" />
                <h3 className="font-semibold text-green-300">Tus pociones, Bruja</h3>
              </div>

              {victim && (
                <div className="mb-4 p-3 bg-black/40 rounded-xl">
                  <p className="text-white/60 text-sm">Esta noche los lobos atacaron a:</p>
                  <p className="text-white font-bold text-lg">{victim.name}</p>
                </div>
              )}

              <div className="space-y-2 mb-4">
                {victim && (
                  <button
                    onClick={() => { setWitchChoice('save'); setSelectedTarget(null); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${witchChoice === 'save' ? 'border-green-500 bg-green-900/30' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                  >
                    <span className="text-2xl">💚</span>
                    <div>
                      <p className="font-medium text-green-300">Poción de Vida</p>
                      <p className="text-xs text-white/50">Salvar a {victim.name}</p>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => { setWitchChoice('poison'); }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${witchChoice === 'poison' ? 'border-red-500 bg-red-900/30' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                >
                  <span className="text-2xl">💀</span>
                  <div>
                    <p className="font-medium text-red-300">Poción de Muerte</p>
                    <p className="text-xs text-white/50">Eliminar a un jugador</p>
                  </div>
                </button>

                <button
                  onClick={() => { setWitchChoice('pass'); setSelectedTarget(null); }}
                  className={`w-full p-3 rounded-xl border transition-all ${witchChoice === 'pass' ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}
                >
                  <p className="text-white/60 text-sm">No usar pociones esta noche</p>
                </button>
              </div>

              {witchChoice === 'poison' && (
                <div className="space-y-2 mb-4">
                  <p className="text-white/50 text-xs mb-1">Elige a tu víctima:</p>
                  {alivePlayers.map(p => (
                    <button
                      key={p.uid}
                      onClick={() => setSelectedTarget(p.uid)}
                      className={`w-full flex items-center gap-2 p-2.5 rounded-xl border text-sm transition-all ${selectedTarget === p.uid ? 'border-red-500 bg-red-900/30' : 'border-white/10 bg-white/5'}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0">{p.name[0]}</div>
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={witchChoice === null || (witchChoice === 'poison' && !selectedTarget)}
                className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
              >
                Confirmar
              </button>
            </div>
          )}

          {/* CUPIDO */}
          {isCupido && !submitted && (
            <div className="bg-pink-900/20 border border-pink-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-pink-400" />
                <h3 className="font-semibold text-pink-300">Elige a los enamorados</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Selecciona 2 jugadores. Si uno muere, el otro también.</p>
              <div className="space-y-2 mb-4">
                {(game.players ?? []).filter(p => p.isAlive).map(p => (
                  <button
                    key={p.uid}
                    onClick={() => toggleCupidTarget(p.uid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${cupidTargets.includes(p.uid) ? 'border-pink-500 bg-pink-900/30' : 'border-white/10 bg-white/5'}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0">{p.name[0]}</div>
                    <span className="font-medium">{p.name}</span>
                    {cupidTargets.includes(p.uid) && <Heart className="h-4 w-4 text-pink-400 ml-auto" />}
                  </button>
                ))}
              </div>
              <button
                onClick={handleSubmit}
                disabled={cupidTargets.length !== 2}
                className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
              >
                Unir en amor eterno
              </button>
            </div>
          )}

          {/* ALDEANO / other non-night roles */}
          {!isNightRole && !submitted && (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-8 text-center">
              <div className="text-6xl mb-4">😴</div>
              <h3 className="font-semibold text-white/70 mb-2">El pueblo duerme</h3>
              <p className="text-white/40 text-sm mb-6">No tienes acción nocturna. Descansa mientras las sombras actúan...</p>
              <button
                onClick={handleAutoSkip}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors"
              >
                Confirmar que estoy dormido
              </button>
            </div>
          )}

          {/* Players status */}
          <div className="bg-black/30 border border-white/5 rounded-xl p-4">
            <p className="text-white/30 text-xs uppercase tracking-wide mb-3">Jugadores vivos</p>
            <div className="grid grid-cols-2 gap-2">
              {(game.players ?? []).filter(p => p.isAlive).map(p => (
                <div key={p.uid} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-white/60 text-sm truncate">{p.name}</span>
                  {p.isAI && <Bot className="h-3 w-3 text-cyan-400/50 flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
