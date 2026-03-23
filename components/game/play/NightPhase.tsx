'use client';

import { useState, useEffect, useRef } from 'react';
import { ROLES } from './roles';
import { GameState, Player } from './GamePlay';
import { Moon, Send, Bot, Eye, Shield, Skull, Heart, Loader2, Music, Star, Zap } from 'lucide-react';
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
  const [flautistaTargets, setFlautistaTargets] = useState<string[]>([]);
  const [wolfMsg, setWolfMsg] = useState('');
  const [wolfMsgs, setWolfMsgs] = useState<{ id: string; name: string; text: string }[]>([]);
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loboBlancoCide, setLoboBlancoCide] = useState<string | null>(null);
  const [perroLoboSide, setPerroLoboSide] = useState<'wolves' | 'village' | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  const round = game.roundNumber ?? 1;
  const subs = game.nightSubmissions ?? {};
  const alivePlayers = (game.players ?? []).filter(p => p.isAlive && p.uid !== userId);
  const allAlivePlayers = (game.players ?? []).filter(p => p.isAlive);

  // Role flags
  const isWolf = myRole === 'Lobo';
  const isLoboBlanco = myRole === 'Lobo Blanco';
  const isWolfTeam = isWolf || isLoboBlanco;
  const isSeer = myRole === 'Vidente';
  const isWitch = myRole === 'Bruja';
  const isCupido = myRole === 'Cupido' && round === 1;
  const isGuardian = myRole === 'Guardián';
  const isFlautista = myRole === 'Flautista';
  const isPerroLobo = myRole === 'Perro Lobo' && round === 1;
  const isSalvaje = myRole === 'Niño Salvaje' && round === 1;
  const isProfeta = myRole === 'Profeta';
  const isNiña = myRole === 'Niña';
  const isSacerdote = myRole === 'Sacerdote';
  const isLadron = myRole === 'Ladrón' && round === 1;

  const isNightRole = isWolfTeam || isSeer || isWitch || isCupido || isGuardian ||
    isFlautista || isPerroLobo || isSalvaje || isProfeta || isSacerdote || isLadron;

  const wolfTarget = game.nightActions?.wolfTarget;
  const victim = wolfTarget ? game.players?.find(p => p.uid === wolfTarget) : null;
  const wolves = (game.players ?? []).filter(p => p.isAlive && (game.roles?.[p.uid] === 'Lobo' || game.roles?.[p.uid] === 'Lobo Blanco'));
  const enchanted = game.enchanted ?? [];

  // Wolf chat listener
  useEffect(() => {
    if (!isWolfTeam) return;
    const q = query(collection(db, 'games', gameId, 'wolfChat'), orderBy('createdAt', 'asc'), limit(50));
    const unsub = onSnapshot(q, (snap: any) => {
      setWolfMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  }, [isWolfTeam, gameId]);

  const handleSubmit = async () => {
    if (submitted) return;
    const action: Record<string, unknown> = {};

    if (isWolf && selectedTarget) action.wolfTarget = selectedTarget;
    if (isLoboBlanco) {
      if (selectedTarget) action.wolfTarget = selectedTarget;
      if (loboBlancoCide && round % 2 === 0) action.loboBlancoCide = loboBlancoCide;
    }
    if (isSeer && selectedTarget) action.seerTarget = selectedTarget;
    if (isProfeta && selectedTarget) action.profetaTarget = selectedTarget;
    if (isWitch) {
      if (witchChoice === 'save') action.witchSave = true;
      if (witchChoice === 'poison' && selectedTarget) action.witchPoison = selectedTarget;
    }
    if (isCupido && cupidTargets.length === 2) action.cupidTargets = cupidTargets;
    if (isGuardian && selectedTarget) action.guardianTarget = selectedTarget;
    if (isFlautista && flautistaTargets.length > 0) action.flautistaTargets = flautistaTargets;
    if (isPerroLobo && perroLoboSide) {
      action.perroLoboSide = perroLoboSide;
    }
    if (isSalvaje && selectedTarget) action.salvajeMentor = selectedTarget;
    if (isSacerdote && selectedTarget) action.sacerdoteTarget = selectedTarget;
    if (isLadron) action._skip = true;
    if (!isNightRole) action._skip = true;

    await onSubmitAction(action);
    setSubmitted(true);
  };

  const handleAutoSkip = async () => {
    await onSubmitAction({ _skip: true });
    setSubmitted(true);
  };

  const sendWolfMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wolfMsg.trim() || !isWolfTeam) return;
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

  const toggleFlautistaTarget = (uid: string) => {
    setFlautistaTargets(prev => {
      if (prev.includes(uid)) return prev.filter(u => u !== uid);
      if (prev.length >= 2) return [prev[1], uid];
      return [...prev, uid];
    });
  };

  // Validation for submit button
  const canSubmit = (() => {
    if (submitted) return false;
    if (isWolf && !selectedTarget) return false;
    if (isLoboBlanco && !selectedTarget) return false;
    if (isSeer && !selectedTarget) return false;
    if (isProfeta && !selectedTarget) return false;
    if (isWitch && witchChoice === null) return false;
    if (isWitch && witchChoice === 'poison' && !selectedTarget) return false;
    if (isCupido && cupidTargets.length !== 2) return false;
    if (isGuardian && !selectedTarget) return false;
    if (isFlautista && flautistaTargets.length === 0) return false;
    if (isPerroLobo && !perroLoboSide) return false;
    if (isSalvaje && !selectedTarget) return false;
    if (isSacerdote && !selectedTarget) return false;
    return true;
  })();

  const playerCard = (p: Player, selected: boolean, onClick: () => void, colorClass = 'border-blue-500 bg-blue-900/30') => (
    <button
      key={p.uid}
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selected ? colorClass : 'border-white/10 bg-white/5 hover:border-white/30'}`}
    >
      <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
        {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : p.name[0]}
      </div>
      <span className="font-medium flex-1 text-left">{p.name}</span>
      {p.isAI && <Bot className="h-3.5 w-3.5 text-cyan-400" />}
      {enchanted.includes(p.uid) && <span title="Hechizado">🎵</span>}
    </button>
  );

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
          <h1 className="font-headline text-2xl font-bold">Noche {round}</h1>
        </div>
        <p className="text-white/40 text-sm mb-8">El pueblo duerme. Las sombras actúan...</p>

        {/* Bear Growl announcement */}
        {game.bearGrowl && (
          <div className="w-full max-w-lg mb-4 bg-amber-900/30 border border-amber-500/40 rounded-xl px-4 py-3 text-center">
            <span className="text-2xl mr-2">🐻</span>
            <span className="text-amber-300 font-medium text-sm">¡El oso ha gruñido! Uno de los vecinos del Domador es un lobo.</span>
          </div>
        )}

        {/* Profeta public reveal */}
        {game.profetaReveal && (
          <div className={`w-full max-w-lg mb-4 p-3 rounded-xl text-sm text-center ${game.profetaReveal.isWolf ? 'bg-red-900/30 text-red-300 border border-red-500/30' : 'bg-green-900/30 text-green-300 border border-green-500/30'}`}>
            📜 <strong>El Profeta revela:</strong> {game.players?.find(p => p.uid === game.profetaReveal?.targetUid)?.name} es {game.profetaReveal.isWolf ? '🐺 un LOBO' : '🌾 inocente'}
          </div>
        )}

        <div className="w-full max-w-lg space-y-4">

          {/* Submitted waiting state */}
          {submitted && (
            <div className="text-center py-8 bg-black/40 border border-white/10 rounded-2xl">
              <Loader2 className="h-8 w-8 animate-spin text-white/40 mx-auto mb-3" />
              <p className="text-white/60">Has actuado. Esperando a los demás...</p>
            </div>
          )}

          {/* ── LOBOS (Lobo + Lobo Blanco) ──────────────────────────────────── */}
          {isWolfTeam && !submitted && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Skull className="h-5 w-5 text-red-400" />
                <h3 className="font-semibold text-red-300">
                  {isLoboBlanco ? 'Lobo Blanco — elegid vuestra presa' : 'Elegid vuestra presa'}
                </h3>
              </div>
              {wolves.length > 0 && (
                <p className="text-red-400/50 text-xs mb-4">
                  Tu manada: {wolves.map(w => w.name).join(', ')}
                </p>
              )}

              <div className="space-y-2 mb-4">
                {alivePlayers
                  .filter(p => game.roles?.[p.uid] !== 'Lobo' && game.roles?.[p.uid] !== 'Lobo Blanco')
                  .map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-red-500 bg-red-900/30'))}
              </div>

              {/* Wolf chat */}
              <div className="bg-black/40 rounded-xl mb-3 overflow-hidden">
                <p className="text-red-400/60 text-xs px-3 pt-2 pb-1 uppercase tracking-wide">Chat de lobos</p>
                <div ref={chatRef} className="h-24 overflow-y-auto px-3 pb-2 space-y-1">
                  {wolfMsgs.map((m: any) => (
                    <p key={m.id} className="text-xs text-white/70">
                      <span className="text-red-400 font-medium">{m.name}:</span> {m.text}
                    </p>
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

              {/* Lobo Blanco special action (every 2 rounds) */}
              {isLoboBlanco && round % 2 === 0 && (
                <div className="mb-3 p-3 bg-white/5 border border-white/10 rounded-xl">
                  <p className="text-white/50 text-xs mb-2">🤍 Acción especial: elimina un lobo aliado (opcional)</p>
                  <div className="space-y-1">
                    {allAlivePlayers
                      .filter(p => p.uid !== userId && (game.roles?.[p.uid] === 'Lobo' || game.roles?.[p.uid] === 'Lobo Blanco'))
                      .map(p => (
                        <button
                          key={p.uid}
                          onClick={() => setLoboBlancoCide(loboBlancoCide === p.uid ? null : p.uid)}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg border text-xs transition-all ${loboBlancoCide === p.uid ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/5'}`}
                        >
                          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-xs">{p.name[0]}</div>
                          {p.name}
                        </button>
                      ))}
                    <button
                      onClick={() => setLoboBlancoCide(null)}
                      className={`w-full p-2 rounded-lg border text-xs transition-all ${loboBlancoCide === null ? 'border-white/30 bg-white/10' : 'border-white/10'}`}
                    >
                      No eliminar a nadie
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
              >
                Confirmar víctima
              </button>
            </div>
          )}

          {/* ── VIDENTE ─────────────────────────────────────────────────────── */}
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
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-purple-500 bg-purple-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                Usar visión
              </button>
            </div>
          )}

          {/* ── PROFETA ──────────────────────────────────────────────────────── */}
          {isProfeta && !submitted && (
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-amber-400" />
                <h3 className="font-semibold text-amber-300">¿A quién profetizas esta noche?</h3>
              </div>
              <p className="text-white/40 text-xs mb-4">Tu visión será revelada al pueblo al amanecer.</p>
              {game.seerReveal && (
                <div className={`mb-4 p-3 rounded-xl text-sm ${game.seerReveal.isWolf ? 'bg-red-900/30 text-red-300' : 'bg-green-900/30 text-green-300'}`}>
                  Noche anterior: {game.players?.find(p => p.uid === game.seerReveal?.targetUid)?.name} es {game.seerReveal.isWolf ? '🐺 un LOBO' : '🌾 inocente'}
                </div>
              )}
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-amber-500 bg-amber-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                Profetizar
              </button>
            </div>
          )}

          {/* ── BRUJA ────────────────────────────────────────────────────────── */}
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
                  <button onClick={() => { setWitchChoice('save'); setSelectedTarget(null); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${witchChoice === 'save' ? 'border-green-500 bg-green-900/30' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                    <span className="text-2xl">💚</span>
                    <div>
                      <p className="font-medium text-green-300">Poción de Vida</p>
                      <p className="text-xs text-white/50">Salvar a {victim.name}</p>
                    </div>
                  </button>
                )}
                <button onClick={() => setWitchChoice('poison')}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${witchChoice === 'poison' ? 'border-red-500 bg-red-900/30' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                  <span className="text-2xl">💀</span>
                  <div>
                    <p className="font-medium text-red-300">Poción de Muerte</p>
                    <p className="text-xs text-white/50">Eliminar a un jugador</p>
                  </div>
                </button>
                <button onClick={() => { setWitchChoice('pass'); setSelectedTarget(null); }}
                  className={`w-full p-3 rounded-xl border transition-all ${witchChoice === 'pass' ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                  <p className="text-white/60 text-sm">No usar pociones esta noche</p>
                </button>
              </div>
              {witchChoice === 'poison' && (
                <div className="space-y-2 mb-4">
                  <p className="text-white/50 text-xs mb-1">Elige a tu víctima:</p>
                  {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-red-500 bg-red-900/30'))}
                </div>
              )}
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* ── CUPIDO ───────────────────────────────────────────────────────── */}
          {isCupido && !submitted && (
            <div className="bg-pink-900/20 border border-pink-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-pink-400" />
                <h3 className="font-semibold text-pink-300">Elige a los enamorados</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Selecciona 2 jugadores. Si uno muere, el otro muere de amor.</p>
              <div className="space-y-2 mb-4">
                {allAlivePlayers.map(p => (
                  <button key={p.uid} onClick={() => toggleCupidTarget(p.uid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${cupidTargets.includes(p.uid) ? 'border-pink-500 bg-pink-900/30' : 'border-white/10 bg-white/5'}`}>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0 overflow-hidden">
                      {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : p.name[0]}
                    </div>
                    <span className="font-medium flex-1 text-left">{p.name}</span>
                    {cupidTargets.includes(p.uid) && <Heart className="h-4 w-4 text-pink-400" />}
                  </button>
                ))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                Unir en amor eterno ({cupidTargets.length}/2)
              </button>
            </div>
          )}

          {/* ── GUARDIÁN ─────────────────────────────────────────────────────── */}
          {isGuardian && !submitted && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-blue-400" />
                <h3 className="font-semibold text-blue-300">¿A quién proteges esta noche?</h3>
              </div>
              {game.guardianLastTarget && (
                <p className="text-white/40 text-xs mb-3">No puedes proteger de nuevo a: {game.players?.find(p => p.uid === game.guardianLastTarget)?.name}</p>
              )}
              <div className="space-y-2 mb-4">
                {allAlivePlayers
                  .filter(p => p.uid !== game.guardianLastTarget)
                  .map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-blue-500 bg-blue-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                Proteger jugador
              </button>
            </div>
          )}

          {/* ── FLAUTISTA ────────────────────────────────────────────────────── */}
          {isFlautista && !submitted && (
            <div className="bg-violet-900/20 border border-violet-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Music className="h-5 w-5 text-violet-400" />
                <h3 className="font-semibold text-violet-300">Encanta a dos jugadores</h3>
              </div>
              <p className="text-white/40 text-xs mb-3">
                Hechizados: {enchanted.length}/{(game.players ?? []).filter(p => p.isAlive).length}
              </p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => (
                  <button key={p.uid} onClick={() => toggleFlautistaTarget(p.uid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${flautistaTargets.includes(p.uid) ? 'border-violet-500 bg-violet-900/30' : enchanted.includes(p.uid) ? 'border-violet-500/30 bg-violet-900/10' : 'border-white/10 bg-white/5'}`}>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0 overflow-hidden">
                      {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : p.name[0]}
                    </div>
                    <span className="font-medium flex-1 text-left">{p.name}</span>
                    {enchanted.includes(p.uid) && <span className="text-xs text-violet-400">🎵 hechizado</span>}
                    {flautistaTargets.includes(p.uid) && <Music className="h-4 w-4 text-violet-400" />}
                  </button>
                ))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                Encantar ({flautistaTargets.length}/2)
              </button>
            </div>
          )}

          {/* ── PERRO LOBO ───────────────────────────────────────────────────── */}
          {isPerroLobo && !submitted && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-yellow-400" />
                <h3 className="font-semibold text-yellow-300">Elige tu bando</h3>
              </div>
              <p className="text-white/50 text-sm mb-5">Esta es tu única oportunidad. ¿Eres aldeano o lobo?</p>
              <div className="space-y-3 mb-5">
                <button onClick={() => setPerroLoboSide('village')}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${perroLoboSide === 'village' ? 'border-green-500 bg-green-900/30' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                  <span className="text-3xl">🧑‍🌾</span>
                  <div className="text-left">
                    <p className="font-bold text-green-300">Aldeano</p>
                    <p className="text-xs text-white/50">Ayudas al pueblo a encontrar a los lobos</p>
                  </div>
                </button>
                <button onClick={() => setPerroLoboSide('wolves')}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${perroLoboSide === 'wolves' ? 'border-red-500 bg-red-900/30' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                  <span className="text-3xl">🐺</span>
                  <div className="text-left">
                    <p className="font-bold text-red-300">Lobo</p>
                    <p className="text-xs text-white/50">Te unes a la manada y atacáis al pueblo</p>
                  </div>
                </button>
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar elección
              </button>
            </div>
          )}

          {/* ── NIÑO SALVAJE ─────────────────────────────────────────────────── */}
          {isSalvaje && !submitted && (
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🌿</span>
                <h3 className="font-semibold text-emerald-300">Elige tu modelo a seguir</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Si esta persona muere, ¡te convertirás en lobo!</p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-emerald-500 bg-emerald-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                Elegir mentor
              </button>
            </div>
          )}

          {/* ── SACERDOTE ────────────────────────────────────────────────────── */}
          {isSacerdote && !submitted && (
            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">✝️</span>
                <h3 className="font-semibold text-indigo-300">¿A quién bendices esta noche?</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">El jugador bendecido estará protegido del ataque de los lobos esta noche.</p>
              <div className="space-y-2 mb-4">
                {allAlivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-indigo-500 bg-indigo-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors">
                Bendecir jugador
              </button>
            </div>
          )}

          {/* ── LADRÓN ───────────────────────────────────────────────────────── */}
          {isLadron && !submitted && (
            <div className="bg-zinc-900/40 border border-zinc-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🦹</span>
                <h3 className="font-semibold text-zinc-300">El Ladrón — primera noche</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">
                En esta versión, el Ladrón puede mirar en secreto el rol de cualquier jugador vivo esta noche.
              </p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => (
                  <button key={p.uid} onClick={() => setSelectedTarget(selectedTarget === p.uid ? null : p.uid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedTarget === p.uid ? 'border-zinc-400 bg-zinc-800/40' : 'border-white/10 bg-white/5'}`}>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0">{p.name[0]}</div>
                    <span className="font-medium flex-1 text-left">{p.name}</span>
                    {selectedTarget === p.uid && game.roles?.[p.uid] && (
                      <span className="text-xs bg-black/40 px-2 py-1 rounded-lg">
                        {ROLES[game.roles[p.uid]]?.emoji} {game.roles[p.uid]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={handleSubmit}
                className="w-full bg-zinc-600 hover:bg-zinc-500 text-white font-bold py-3 rounded-xl transition-colors">
                Continuar
              </button>
            </div>
          )}

          {/* ── NIÑA (passive — knows wolves) ──────────────────────────────── */}
          {isNiña && !submitted && (
            <div className="bg-pink-900/20 border border-pink-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">👧</span>
                <h3 className="font-semibold text-pink-300">La Niña espía a los lobos</h3>
              </div>
              <p className="text-pink-300/70 text-sm mb-4">Has espiado a la manada. Esta noche los lobos son:</p>
              <div className="space-y-2 mb-4">
                {(game.players ?? [])
                  .filter(p => p.isAlive && (game.roles?.[p.uid] === 'Lobo' || game.roles?.[p.uid] === 'Lobo Blanco'))
                  .map(p => (
                    <div key={p.uid} className="flex items-center gap-3 p-3 rounded-xl bg-red-900/20 border border-red-500/30">
                      <span className="text-xl">🐺</span>
                      <span className="font-medium">{p.name}</span>
                    </div>
                  ))}
              </div>
              <button onClick={handleAutoSkip}
                className="w-full bg-pink-600/60 hover:bg-pink-500/60 text-white font-bold py-3 rounded-xl transition-colors">
                He visto suficiente
              </button>
            </div>
          )}

          {/* ── Passive info panels ─────────────────────────────────────────── */}

          {/* Gemelas: see twin */}
          {myRole === 'Gemelas' && !submitted && (
            <div className="bg-pink-900/20 border border-pink-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">👯</span>
                <h3 className="font-semibold text-pink-300">Tu hermana gemela</h3>
              </div>
              {(game.players ?? [])
                .filter(p => p.uid !== userId && game.roles?.[p.uid] === 'Gemelas' && p.isAlive)
                .map(p => (
                  <div key={p.uid} className="flex items-center gap-3 p-3 rounded-xl bg-pink-900/20 border border-pink-500/30">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                      {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : p.name[0]}
                    </div>
                    <span className="font-medium">{p.name}</span>
                  </div>
                ))}
              <button onClick={handleAutoSkip} className="mt-4 w-full bg-pink-600/50 hover:bg-pink-500/50 text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Hermanos: see brothers */}
          {myRole === 'Hermanos' && !submitted && (
            <div className="bg-orange-900/20 border border-orange-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">👬</span>
                <h3 className="font-semibold text-orange-300">Tus hermanos</h3>
              </div>
              {(game.players ?? [])
                .filter(p => p.uid !== userId && game.roles?.[p.uid] === 'Hermanos' && p.isAlive)
                .map(p => (
                  <div key={p.uid} className="flex items-center gap-3 p-3 rounded-xl bg-orange-900/20 border border-orange-500/30 mb-2">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                      {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : p.name[0]}
                    </div>
                    <span className="font-medium">{p.name}</span>
                  </div>
                ))}
              <button onClick={handleAutoSkip} className="mt-2 w-full bg-orange-600/50 hover:bg-orange-500/50 text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Médium: access to ghost chat */}
          {myRole === 'Médium' && !submitted && (
            <div className="bg-slate-900/40 border border-slate-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">👻</span>
                <h3 className="font-semibold text-slate-300">El Médium escucha a los muertos</h3>
              </div>
              <p className="text-slate-400 text-sm mb-4">Puedes leer los mensajes del chat de fantasmas en la fase de día para obtener pistas de los eliminados.</p>
              <button onClick={handleAutoSkip} className="w-full bg-slate-600/50 hover:bg-slate-500/50 text-white font-bold py-3 rounded-xl transition-colors">
                Entendido
              </button>
            </div>
          )}

          {/* Ángel: reminder */}
          {myRole === 'Ángel' && !submitted && (
            <div className="bg-sky-900/20 border border-sky-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">😇</span>
                <h3 className="font-semibold text-sky-300">¡Necesitas morir!</h3>
              </div>
              <p className="text-sky-300/70 text-sm mb-4">
                {round === 1
                  ? 'Mañana en la votación, consigue que el pueblo te elimine a ti. Si lo logras en esta primera ronda, ¡ganas!'
                  : 'No conseguiste ganar en la ronda 1. Ahora ayuda al pueblo a eliminar a los lobos.'}
              </p>
              <button onClick={handleAutoSkip} className="w-full bg-sky-600/50 hover:bg-sky-500/50 text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Antiguo: reminder */}
          {myRole === 'Antiguo' && !submitted && (
            <div className="bg-stone-900/40 border border-stone-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🧙</span>
                <h3 className="font-semibold text-stone-300">El Antiguo descansa</h3>
              </div>
              <p className="text-stone-300/70 text-sm mb-4">
                {(game.antiguoHit ?? []).includes(userId)
                  ? 'Los lobos ya te atacaron una vez. Esta noche... podrías no sobrevivir.'
                  : 'Si los lobos te atacan esta noche, sobrevivirás gracias a tu experiencia milenaria.'}
              </p>
              <button onClick={handleAutoSkip} className="w-full bg-stone-600/50 hover:bg-stone-500/50 text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Pícaro: reminder */}
          {myRole === 'Pícaro' && !submitted && (
            <div className="bg-yellow-900/20 border border-yellow-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🃏</span>
                <h3 className="font-semibold text-yellow-300">El Pícaro observa</h3>
              </div>
              <p className="text-yellow-300/70 text-sm mb-4">Convence a todos de eliminar a los aldeanos. Necesitas ser el único no-lobo en sobrevivir para ganar.</p>
              <button onClick={handleAutoSkip} className="w-full bg-yellow-600/50 hover:bg-yellow-500/50 text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Juez: reminder */}
          {myRole === 'Juez' && !submitted && (
            <div className="bg-gray-900/40 border border-gray-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">⚖️</span>
                <h3 className="font-semibold text-gray-300">El Juez descansa</h3>
              </div>
              <p className="text-gray-300/70 text-sm mb-4">Recuerda: durante el día puedes pedir una segunda votación antes de ejecutar la sentencia. Úsalo estratégicamente.</p>
              <button onClick={handleAutoSkip} className="w-full bg-gray-600/50 hover:bg-gray-500/50 text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Oso: bear growl result */}
          {myRole === 'Oso' && !submitted && (
            <div className="bg-amber-900/20 border border-amber-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🐻</span>
                <h3 className="font-semibold text-amber-300">El Oso gruñe...</h3>
              </div>
              <p className="text-amber-300/70 text-sm mb-4">
                {game.bearGrowl
                  ? '¡Tu oso ha gruñido! Uno de tus vecinos inmediatos es un lobo. Mañana debes alertar al pueblo.'
                  : 'Tu oso está tranquilo. Ninguno de tus vecinos inmediatos es un lobo.'}
              </p>
              <button onClick={handleAutoSkip} className="w-full bg-amber-600/50 hover:bg-amber-500/50 text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Chivo Expiatorio & Alquimista & Espía: generic passive */}
          {['Chivo Expiatorio', 'Alquimista', 'Espía', 'Cazador', 'Alcalde'].includes(myRole) && !submitted && (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-3">{ROLES[myRole]?.emoji ?? '😴'}</div>
              <h3 className="font-semibold text-white/80 mb-2">{ROLES[myRole]?.name ?? myRole}</h3>
              <p className="text-white/40 text-sm mb-6">{ROLES[myRole]?.description}</p>
              <button onClick={handleAutoSkip}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Default: Aldeano / other non-night roles */}
          {!isNightRole &&
            !['Niña', 'Gemelas', 'Hermanos', 'Médium', 'Ángel', 'Antiguo', 'Pícaro', 'Juez', 'Oso',
              'Chivo Expiatorio', 'Alquimista', 'Espía', 'Cazador', 'Alcalde'].includes(myRole) &&
            !submitted && (
              <div className="bg-black/40 border border-white/10 rounded-2xl p-8 text-center">
                <div className="text-6xl mb-4">😴</div>
                <h3 className="font-semibold text-white/70 mb-2">El pueblo duerme</h3>
                <p className="text-white/40 text-sm mb-6">No tienes acción nocturna. Descansa mientras las sombras actúan...</p>
                <button onClick={handleAutoSkip}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
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
                  {enchanted.includes(p.uid) && <span className="text-xs">🎵</span>}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
