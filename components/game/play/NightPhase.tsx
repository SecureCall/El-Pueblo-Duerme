'use client';

import { useState, useEffect, useRef } from 'react';
import { ROLES } from './roles';
import { getRoleIcon } from './roleIcons';
import { GameState, Player } from './GamePlay';
import { Moon, Send, Bot, Eye, Shield, Skull, Heart, Loader2, Music, Star, Zap } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useNarrator, waitForAudio } from '@/hooks/useNarrator';
import { EmoteBar } from './EmoteBar';

interface Props {
  game: GameState;
  gameId: string;
  myRole: string;
  me?: Player;
  userId: string;
  userName: string;
  isHost: boolean;
  onSubmitAction: (action: Record<string, unknown>) => Promise<void>;
}

export function NightPhase({ game, gameId, myRole, me, userId, userName, isHost, onSubmitAction }: Props) {
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
  const [autoSkipCountdown, setAutoSkipCountdown] = useState<number | null>(null);
  const [narratorReady, setNarratorReady] = useState(false);
  const [nightSecondsLeft, setNightSecondsLeft] = useState<number>(90);
  const [espiaViewActive, setEspiaViewActive] = useState(false);
  const [wolfMsgsForEspia, setWolfMsgsForEspia] = useState<{ id: string; name: string; text: string }[]>([]);
  const [vigiaActivated, setVigiaActivated] = useState(false);
  const [bansheeTarget, setBansheeTarget] = useState<string | null>(null);
  const [secondWolfTarget, setSecondWolfTarget] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const { play, AUDIO_FILES } = useNarrator();
  const isEspia = myRole === 'Espía';

  const round = game.roundNumber ?? 1;
  const subs = game.nightSubmissions ?? {};
  const alivePlayers = (game.players ?? []).filter(p => p.isAlive && p.uid !== userId);
  const allAlivePlayers = (game.players ?? []).filter(p => p.isAlive);

  // Role flags
  const isWolf = myRole === 'Lobo';
  const isLoboBlanco = myRole === 'Lobo Blanco';
  const isCriaLobo = myRole === 'Cría de Lobo';
  const isWolfTeam = isWolf || isLoboBlanco || isCriaLobo;
  const isSeer = myRole === 'Vidente';
  const isWitch = myRole === 'Hechicera';
  const isLoboBruja = myRole === 'Bruja'; // wolf-team Bruja
  const isCupido = myRole === 'Cupido' && round === 1;
  const isGuardian = myRole === 'Guardián';
  const isDoctor = myRole === 'Doctor';
  const isFlautista = myRole === 'Flautista';
  const isPerroLobo = myRole === 'Perro Lobo' && round === 1;
  const isSalvaje = myRole === 'Niño Salvaje' && round === 1;
  const isProfeta = myRole === 'Profeta';
  const isNiña = myRole === 'Niña';
  const isSacerdote = myRole === 'Sacerdote';
  const isLadron = myRole === 'Ladrón' && round === 1;
  const isAnciana = myRole === 'Anciana Líder';
  const isAngelResucitador = myRole === 'Ángel Resucitador' && !game.angelResucitadorUsed;
  const isSilenciadora = myRole === 'Silenciadora';
  const isSirena = myRole === 'Sirena del Río' && round === 1;
  const isVirginia = myRole === 'Virginia Woolf' && round === 1;
  const isVigia = myRole === 'Vigía' && !game.vigiaUsed;
  const isBanshee = myRole === 'Banshee';
  const isCambiaformas = myRole === 'Cambiaformas' && round === 1;
  const isLiderCulto = myRole === 'Líder del Culto';
  const isPescador = myRole === 'Pescador';
  const isVampiro = myRole === 'Vampiro';
  const isHadaBuscadora = myRole === 'Hada Buscadora' && !game.hadaLinked;
  const isForense = myRole === 'Médico Forense';
  const isSaboteador = myRole === 'Saboteador';
  const isIluminado = myRole === 'Iluminado';

  const isNightRole = isWolfTeam || isSeer || isWitch || isLoboBruja || isCupido || isGuardian ||
    isDoctor || isFlautista || isPerroLobo || isSalvaje || isProfeta || isSacerdote || isLadron ||
    isAnciana || isAngelResucitador || isSilenciadora || isSirena || isVirginia || isVigia ||
    isBanshee || isCambiaformas || isLiderCulto || isPescador || isVampiro || isHadaBuscadora ||
    isForense || isSaboteador;

  const wolfTarget = game.nightActions?.wolfTarget;
  const victim = wolfTarget ? game.players?.find(p => p.uid === wolfTarget) : null;
  const wolves = (game.players ?? []).filter(p => p.isAlive && (game.roles?.[p.uid] === 'Lobo' || game.roles?.[p.uid] === 'Lobo Blanco'));
  const enchanted = game.enchanted ?? [];

  // Wolf chat listener (for wolf team + Bruja ally)
  const canSeeWolfChat = isWolfTeam || isLoboBruja;
  useEffect(() => {
    if (!canSeeWolfChat) return;
    const q = query(collection(db, 'games', gameId, 'wolfChat'), orderBy('createdAt', 'asc'), limit(50));
    const unsub = onSnapshot(q, (snap: any) => {
      setWolfMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  }, [canSeeWolfChat, gameId]);

  // Wolf chat listener for Espía (read-only, only when activated)
  useEffect(() => {
    if (!isEspia || !espiaViewActive) return;
    const q = query(collection(db, 'games', gameId, 'wolfChat'), orderBy('createdAt', 'asc'), limit(50));
    const unsub = onSnapshot(q, (snap: any) => {
      setWolfMsgsForEspia(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [isEspia, espiaViewActive, gameId]);

  // Wait for narrator to finish, then start nightAmbient and unlock timers
  useEffect(() => {
    setNarratorReady(false);
    let cancelled = false;
    waitForAudio().then(() => {
      if (cancelled) return;
      setNarratorReady(true);
      play(AUDIO_FILES.nightAmbient);
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Auto-submit for non-night roles (Aldeano, etc.) — starts AFTER narrator finishes
  useEffect(() => {
    if (!narratorReady || submitted) return;
    if (isNightRole || isEspia) return;

    let seconds = 8;
    setAutoSkipCountdown(seconds);
    const interval = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(interval);
        setAutoSkipCountdown(null);
        onSubmitAction({ _skip: true }).then(() => setSubmitted(true)).catch(() => {});
      } else {
        setAutoSkipCountdown(seconds);
      }
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, submitted, narratorReady]);

  // 35-second auto-submit for night roles — starts AFTER narrator finishes
  useEffect(() => {
    if (!narratorReady || submitted) return;
    if (!isNightRole && !isEspia) return;

    const timer = setTimeout(() => {
      if (!submitted) {
        onSubmitAction({ _skip: true }).then(() => setSubmitted(true)).catch(() => {});
      }
    }, 35000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, submitted, narratorReady]);

  // Visible night countdown based on nightStartedAt (90s max)
  const NIGHT_DURATION = 90;
  useEffect(() => {
    if (!game.nightStartedAt) return;
    const startedAt = game.nightStartedAt;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setNightSecondsLeft(Math.max(0, NIGHT_DURATION - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [game.nightStartedAt]);

  const handleSubmit = async () => {
    if (submitted) return;
    const action: Record<string, unknown> = {};

    if ((isWolf || isCriaLobo) && selectedTarget) action.wolfTarget = selectedTarget;
    if (isLoboBlanco) {
      if (selectedTarget) action.wolfTarget = selectedTarget;
      if (loboBlancoCide && round % 2 === 0) action.loboBlancoCide = loboBlancoCide;
    }
    if (game.criaLoboRage && isWolfTeam && secondWolfTarget) action.wolfTarget2 = secondWolfTarget;
    if (isSeer && selectedTarget) action.seerTarget = selectedTarget;
    if (isProfeta && selectedTarget) action.profetaTarget = selectedTarget;
    if (isWitch) {
      if (witchChoice === 'save') action.witchSave = true;
      if (witchChoice === 'poison' && selectedTarget) action.witchPoison = selectedTarget;
    }
    if (isLoboBruja && selectedTarget) action.brujaTarget = selectedTarget;
    if (isCupido && cupidTargets.length === 2) action.cupidTargets = cupidTargets;
    if (isGuardian && selectedTarget) action.guardianTarget = selectedTarget;
    if (isDoctor && selectedTarget) action.doctorTarget = selectedTarget;
    if (isFlautista && flautistaTargets.length > 0) action.flautistaTargets = flautistaTargets;
    if (isPerroLobo && perroLoboSide) action.perroLoboSide = perroLoboSide;
    if (isSalvaje && selectedTarget) action.salvajeMentor = selectedTarget;
    if (isSacerdote && selectedTarget) action.sacerdoteTarget = selectedTarget;
    if (isLadron && selectedTarget) action.ladronTarget = selectedTarget;
    else if (isLadron) action._skip = true;
    if (isAnciana && selectedTarget) action.ancianaTarget = selectedTarget;
    if (isAngelResucitador && selectedTarget) action.angelResucitarTarget = selectedTarget;
    if (isSilenciadora && selectedTarget) action.silenciadoraTarget = selectedTarget;
    if (isSirena && selectedTarget) action.sirenaTarget = selectedTarget;
    if (isVirginia && selectedTarget) action.virginiawoolTarget = selectedTarget;
    if (isVigia && vigiaActivated) action.vigiaActivate = true;
    if (isBanshee && bansheeTarget) action.bansheePrediction = bansheeTarget;
    if (isCambiaformas && selectedTarget) action.cambiaformasTarget = selectedTarget;
    if (isLiderCulto && selectedTarget) action.liderCultoTarget = selectedTarget;
    if (isPescador && selectedTarget) action.pescadorTarget = selectedTarget;
    if (isVampiro && selectedTarget) action.vampiroTarget = selectedTarget;
    if (isHadaBuscadora && selectedTarget) action.hadaBuscadoraTarget = selectedTarget;
    if (isEspia && espiaViewActive) action.espiaActivate = true;
    else if (isEspia) action._skip = true;
    if (isForense && selectedTarget) action.forenseTarget = selectedTarget;
    else if (isForense) action._skip = true;
    if (isSaboteador && selectedTarget) action.saboteadorTarget = selectedTarget;
    else if (isSaboteador) action._skip = true;
    if (!isNightRole && !isEspia) action._skip = true;

    await onSubmitAction(action);
    setSubmitted(true);
  };

  const handleAutoSkip = async () => {
    await onSubmitAction({ _skip: true });
    setSubmitted(true);
  };

  const sendWolfMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wolfMsg.trim() || !canSeeWolfChat) return;
    setSendingMsg(true);
    await addDoc(collection(db, 'games', gameId, 'wolfChat'), {
      name: userName,
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
    if ((isWolf || isCriaLobo) && !selectedTarget) return false;
    if (isLoboBlanco && !selectedTarget) return false;
    if (isSeer && !selectedTarget) return false;
    if (isProfeta && !selectedTarget) return false;
    if (isWitch && witchChoice === null) return false;
    if (isWitch && witchChoice === 'poison' && !selectedTarget) return false;
    if (isLoboBruja && !selectedTarget) return false;
    if (isCupido && cupidTargets.length !== 2) return false;
    if (isGuardian && !selectedTarget) return false;
    if (isDoctor && !selectedTarget) return false;
    if (isFlautista && flautistaTargets.length === 0) return false;
    if (isPerroLobo && !perroLoboSide) return false;
    if (isSalvaje && !selectedTarget) return false;
    if (isSacerdote && !selectedTarget) return false;
    if (isLadron && !selectedTarget) return false;
    if (isAnciana && !selectedTarget) return false;
    if (isAngelResucitador && !selectedTarget) return false;
    if (isSilenciadora && !selectedTarget) return false;
    if (isSirena && !selectedTarget) return false;
    if (isVirginia && !selectedTarget) return false;
    if (isBanshee && !bansheeTarget) return false;
    if (isCambiaformas && !selectedTarget) return false;
    if (isLiderCulto && !selectedTarget) return false;
    if (isPescador && !selectedTarget) return false;
    if (isVampiro && !selectedTarget) return false;
    if (isHadaBuscadora && !selectedTarget) return false;
    if (isForense && !selectedTarget) return false;
    if (isSaboteador && !selectedTarget) return false;
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
        <p className="text-white/40 text-sm mb-3">El pueblo duerme. Las sombras actúan...</p>

        {/* Night timer bar */}
        {game.nightStartedAt && (
          <div className="w-full max-w-lg mb-5">
            <div className="flex justify-between text-xs text-white/40 mb-1">
              <span>⏱ Tiempo de noche</span>
              <span className={nightSecondsLeft <= 15 ? 'text-red-400 font-bold' : ''}>{nightSecondsLeft}s</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${(nightSecondsLeft / 90) * 100}%`,
                  backgroundColor: nightSecondsLeft <= 15 ? '#ef4444' : nightSecondsLeft <= 30 ? '#f59e0b' : '#3b82f6',
                }} />
            </div>
          </div>
        )}

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

          {/* ── LOBOS (Lobo + Lobo Blanco + Cría de Lobo) ───────────────────── */}
          {isWolfTeam && !submitted && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-1">
                <Skull className="h-5 w-5 text-red-400" />
                <h3 className="font-semibold text-red-300">
                  {isLoboBlanco ? 'Lobo Blanco — elegid vuestra presa' : isCriaLobo ? 'Cría de Lobo — elegid vuestra presa' : 'Elegid vuestra presa'}
                </h3>
              </div>
              {wolves.length > 0 && (
                <p className="text-red-400/50 text-xs mb-4">
                  Tu manada: {wolves.map(w => w.name).join(', ')}
                </p>
              )}
              {game.lobosBlocked && (
                <div className="mb-3 bg-red-950/40 border border-red-800/50 rounded-xl p-3 text-xs text-red-300">
                  ⚠️ La Leprosa murió en vuestras garras. Esta noche <strong>no podéis matar</strong> a nadie.
                </div>
              )}

              <div className="space-y-2 mb-4">
                {alivePlayers
                  .filter(p => game.roles?.[p.uid] !== 'Lobo' && game.roles?.[p.uid] !== 'Lobo Blanco' && game.roles?.[p.uid] !== 'Cría de Lobo')
                  .map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-red-500 bg-red-900/30'))}
              </div>

              {/* Cría de Lobo rage: pick 2nd target */}
              {game.criaLoboRage && (
                <div className="mb-3 p-3 bg-red-950/40 border border-red-700/40 rounded-xl">
                  <p className="text-xs text-red-300 mb-2">🐺 ¡La Cría de Lobo murió! Podéis matar a una segunda víctima esta noche.</p>
                  <div className="space-y-1">
                    {alivePlayers
                      .filter(p => game.roles?.[p.uid] !== 'Lobo' && game.roles?.[p.uid] !== 'Lobo Blanco' && game.roles?.[p.uid] !== 'Cría de Lobo' && p.uid !== selectedTarget)
                      .map(p => (
                        <button key={p.uid} onClick={() => setSecondWolfTarget(secondWolfTarget === p.uid ? null : p.uid)}
                          className={`w-full flex items-center gap-2 p-2 rounded-lg border text-xs transition-all ${secondWolfTarget === p.uid ? 'border-red-400 bg-red-900/40' : 'border-white/10 bg-white/5'}`}>
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">{p.name[0]}</div>
                          {p.name}
                        </button>
                      ))}
                    <button onClick={() => setSecondWolfTarget(null)}
                      className={`w-full p-2 rounded-lg border text-xs ${!secondWolfTarget ? 'border-white/30 bg-white/10' : 'border-white/10'}`}>
                      No elegir segunda víctima
                    </button>
                  </div>
                </div>
              )}

              {/* Bruja found Vidente — show alert */}
              {game.brujaFoundVidente && (
                <div className="mb-3 bg-purple-950/40 border border-purple-700/40 rounded-xl p-3 text-xs text-purple-300">
                  🔮 La Bruja aliada <strong>ha encontrado a la Vidente</strong>. Considera si eliminarla esta noche.
                </div>
              )}

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

          {/* ── CHAT DE LOBOS — siempre visible para el equipo lobo + Bruja ─── */}
          {canSeeWolfChat && (
            <div className="bg-red-950/30 border border-red-500/20 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-500/10">
                <span className="text-base">🐺</span>
                <p className="text-red-400/80 text-xs font-semibold uppercase tracking-wide">Chat de lobos</p>
                {isLoboBruja && <span className="text-[10px] text-red-400/50 ml-auto">Aliada — solo lectura y escritura</span>}
                {submitted && <span className="text-[10px] text-white/30 ml-auto">Ya actuaste — puedes seguir hablando</span>}
              </div>
              <div ref={chatRef} className="h-36 overflow-y-auto px-4 py-3 space-y-1.5">
                {wolfMsgs.length === 0 && (
                  <p className="text-white/20 text-xs text-center pt-4">La manada no ha hablado aún…</p>
                )}
                {wolfMsgs.map((m: any) => (
                  <p key={m.id} className="text-xs text-white/75">
                    <span className="text-red-400 font-semibold">{m.name}:</span> {m.text}
                  </p>
                ))}
              </div>
              <form onSubmit={sendWolfMsg} className="flex gap-2 px-3 py-2 border-t border-red-500/10">
                <input
                  value={wolfMsg}
                  onChange={e => setWolfMsg(e.target.value)}
                  placeholder="Hablar con tu manada…"
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-white/25 outline-none"
                  maxLength={150}
                />
                <button type="submit" disabled={!wolfMsg.trim() || sendingMsg}
                  className="text-red-400 hover:text-red-300 disabled:opacity-30 transition-colors">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
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
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🦹</span>
                <h3 className="font-semibold text-zinc-300">El Ladrón — primera noche</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Elige a un jugador y <strong className="text-zinc-200">roba su rol</strong>. Ese jugador pasará a ser Aldeano. O no robes nada.</p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => {
                  const sel = selectedTarget === p.uid;
                  return (
                    <button key={p.uid} onClick={() => setSelectedTarget(sel ? null : p.uid)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${sel ? 'border-zinc-400 bg-zinc-800/60' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0 overflow-hidden">
                        {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : p.name[0]}
                      </div>
                      <span className="font-medium flex-1 text-left">{p.name}</span>
                      {sel && game.roles?.[p.uid] && (
                        <span className="text-xs bg-black/50 border border-zinc-500/40 px-2 py-1 rounded-lg text-zinc-200">
                          {ROLES[game.roles[p.uid]]?.emoji} {game.roles[p.uid]}
                        </span>
                      )}
                      {p.isAI && <Bot className="h-3.5 w-3.5 text-cyan-400" />}
                    </button>
                  );
                })}
              </div>
              {selectedTarget && (
                <button onClick={handleSubmit}
                  className="w-full bg-zinc-500 hover:bg-zinc-400 text-white font-bold py-3 rounded-xl transition-colors mb-2">
                  🦹 Robar rol de {alivePlayers.find(p => p.uid === selectedTarget)?.name}
                </button>
              )}
              <button onClick={async () => { await onSubmitAction({ _skip: true }); setSubmitted(true); }}
                className="w-full bg-white/10 hover:bg-white/15 border border-white/20 text-white/70 text-sm py-2.5 rounded-xl transition-colors">
                No robar nada esta noche
              </button>
            </div>
          )}

          {/* ── HECHICERA (old village witch — save / poison) ────────────────── */}
          {isWitch && !submitted && (
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🧪</span>
                <h3 className="font-semibold text-emerald-300">Hechicera — pociones mágicas</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">
                Tienes {game.hechiceraLifeUsed ? '0' : '1'} poción de vida y {game.hechiceraPoisonUsed ? '0' : '1'} poción de muerte.
              </p>
              {victim && !game.hechiceraLifeUsed && (
                <div className="mb-3 p-3 bg-black/30 rounded-xl text-sm">
                  <span className="text-white/50">Esta noche los lobos van a por: </span>
                  <span className="text-white font-semibold">{victim.name}</span>
                </div>
              )}
              <div className="space-y-2 mb-4">
                {!game.hechiceraLifeUsed && victim && (
                  <button onClick={() => setWitchChoice(witchChoice === 'save' ? null : 'save')}
                    className={`w-full p-3 rounded-xl border text-sm transition-all ${witchChoice === 'save' ? 'border-emerald-400 bg-emerald-900/40 text-emerald-200' : 'border-white/10 bg-white/5'}`}>
                    💚 Salvar a {victim.name}
                  </button>
                )}
                {!game.hechiceraPoisonUsed && (
                  <button onClick={() => setWitchChoice(witchChoice === 'poison' ? null : 'poison')}
                    className={`w-full p-3 rounded-xl border text-sm transition-all ${witchChoice === 'poison' ? 'border-red-400 bg-red-900/40 text-red-200' : 'border-white/10 bg-white/5'}`}>
                    ☠️ Envenenar a alguien
                  </button>
                )}
                <button onClick={() => setWitchChoice('pass')}
                  className={`w-full p-3 rounded-xl border text-sm transition-all ${witchChoice === 'pass' ? 'border-white/40 bg-white/10' : 'border-white/10 bg-white/5'}`}>
                  Pasar esta noche
                </button>
              </div>
              {witchChoice === 'poison' && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-white/50 mb-2">¿A quién envenenamos?</p>
                  {allAlivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-red-500 bg-red-900/30'))}
                </div>
              )}
              <button onClick={handleSubmit} disabled={!canSubmit || !witchChoice}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* ── BRUJA (wolf team — find Vidente) ─────────────────────────────── */}
          {isLoboBruja && !submitted && (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🧙‍♀️</span>
                <h3 className="font-semibold text-purple-300">Bruja — aliada de los lobos</h3>
              </div>
              {game.brujaFoundVidente ? (
                <div className="mb-4 p-3 rounded-xl bg-yellow-900/30 border border-yellow-500/30 text-sm text-yellow-200">
                  ✅ Ya encontraste a la Vidente. Los lobos están avisados.
                </div>
              ) : (
                <p className="text-white/50 text-xs mb-4">Elige a un jugador para comprobar si es la Vidente. Si la encuentras, los lobos recibirán protección especial.</p>
              )}
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-purple-500 bg-purple-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Investigar
              </button>
            </div>
          )}

          {/* ── DOCTOR ───────────────────────────────────────────────────────── */}
          {isDoctor && !submitted && (
            <div className="bg-teal-900/20 border border-teal-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🩺</span>
                <h3 className="font-semibold text-teal-300">Doctor — protege a alguien</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">
                No puedes elegir a la misma persona dos noches seguidas.
                {!game.doctorSelfUsed && ' Puedes protegerte a ti mismo una vez.'}
              </p>
              <div className="space-y-2 mb-4">
                {allAlivePlayers
                  .filter(p => p.uid !== game.doctorLastTarget)
                  .map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-teal-500 bg-teal-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Proteger
              </button>
            </div>
          )}

          {/* ── ANCIANA LÍDER ─────────────────────────────────────────────────── */}
          {isAnciana && !submitted && (
            <div className="bg-amber-900/20 border border-amber-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">👵</span>
                <h3 className="font-semibold text-amber-300">Anciana Líder — exiliar poder</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Elige a un jugador. Esta noche su poder nocturno queda bloqueado (no podrá actuar).</p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-amber-500 bg-amber-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Exiliar poder
              </button>
            </div>
          )}

          {/* ── ÁNGEL RESUCITADOR ─────────────────────────────────────────────── */}
          {isAngelResucitador && !submitted && (
            <div className="bg-sky-900/20 border border-sky-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">😇</span>
                <h3 className="font-semibold text-sky-300">Ángel Resucitador — traer de vuelta</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Puedes resucitar a un jugador muerto <strong>una sola vez</strong>. Si no hay muertos, pasa.</p>
              {(() => {
                const dead = (game.players ?? []).filter(p => !p.isAlive);
                return dead.length === 0 ? (
                  <div className="mb-4 p-3 rounded-xl bg-black/30 text-white/40 text-sm text-center">Nadie ha muerto aún.</div>
                ) : (
                  <div className="space-y-2 mb-4">
                    {dead.map(p => (
                      <button key={p.uid} onClick={() => setSelectedTarget(selectedTarget === p.uid ? null : p.uid)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedTarget === p.uid ? 'border-sky-500 bg-sky-900/30' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm flex-shrink-0 overflow-hidden">
                          {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : p.name[0]}
                        </div>
                        <span className="flex-1 text-left font-medium">{p.name}</span>
                        <span className="text-xs text-white/30">{game.eliminatedHistory?.find(h => h.uid === p.uid)?.role ?? ''}</span>
                      </button>
                    ))}
                  </div>
                );
              })()}
              <div className="space-y-2">
                {selectedTarget && (
                  <button onClick={handleSubmit}
                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-xl transition-colors">
                    Resucitar a {(game.players ?? []).find(p => p.uid === selectedTarget)?.name}
                  </button>
                )}
                <button onClick={handleAutoSkip}
                  className="w-full bg-white/10 hover:bg-white/15 border border-white/20 text-white/70 text-sm py-2.5 rounded-xl transition-colors">
                  Pasar (no resucitar)
                </button>
              </div>
            </div>
          )}

          {/* ── SILENCIADORA ─────────────────────────────────────────────────── */}
          {isSilenciadora && !submitted && (
            <div className="bg-slate-900/30 border border-slate-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🤫</span>
                <h3 className="font-semibold text-slate-300">Silenciadora — callar una voz</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">El jugador elegido no podrá hablar en el chat del día siguiente.</p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-slate-400 bg-slate-800/40'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Silenciar
              </button>
            </div>
          )}

          {/* ── SIRENA DEL RÍO (night 1) ─────────────────────────────────────── */}
          {isSirena && !submitted && (
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🧜‍♀️</span>
                <h3 className="font-semibold text-cyan-300">Sirena del Río — hechizar</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Elige a un jugador. En los días siguientes, ese jugador deberá votar igual que tú.</p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-cyan-500 bg-cyan-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Hechizar
              </button>
            </div>
          )}

          {/* ── VIRGINIA WOOLF (night 1) ──────────────────────────────────────── */}
          {isVirginia && !submitted && (
            <div className="bg-rose-900/20 border border-rose-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📖</span>
                <h3 className="font-semibold text-rose-300">Virginia Woolf — destino ligado</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Elige a un jugador. Si mueres, ese jugador morirá contigo.</p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-rose-500 bg-rose-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Ligar destino
              </button>
            </div>
          )}

          {/* ── VIGÍA ─────────────────────────────────────────────────────────── */}
          {isVigia && !submitted && (
            <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🔭</span>
                <h3 className="font-semibold text-indigo-300">Vigía — guardia de noche</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">
                Si activas tu guardia y los lobos no te atacan, sabrás quiénes son los lobos.
                Si los lobos sí te atacan, mueres y pierdes el poder.
                Puedes usarlo solo <strong>una vez</strong>.
              </p>
              <div className="space-y-2 mb-4">
                <button onClick={() => setVigiaActivated(!vigiaActivated)}
                  className={`w-full p-3 rounded-xl border text-sm transition-all ${vigiaActivated ? 'border-indigo-400 bg-indigo-900/40 text-indigo-200' : 'border-white/10 bg-white/5'}`}>
                  🔭 {vigiaActivated ? 'Guardia activada ✓' : 'Activar guardia esta noche'}
                </button>
              </div>
              <div className="space-y-2">
                <button onClick={handleSubmit}
                  disabled={!vigiaActivated}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                  Confirmar guardia
                </button>
                <button onClick={handleAutoSkip}
                  className="w-full bg-white/10 hover:bg-white/15 border border-white/20 text-white/70 text-sm py-2.5 rounded-xl transition-colors">
                  Pasar (no usar guardia)
                </button>
              </div>
            </div>
          )}

          {/* ── BANSHEE ───────────────────────────────────────────────────────── */}
          {isBanshee && !submitted && (
            <div className="bg-violet-900/20 border border-violet-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">👤</span>
                <h3 className="font-semibold text-violet-300">Banshee — predecir una muerte</h3>
              </div>
              <p className="text-white/50 text-xs mb-2">Elige a quien crees que morirá esta noche. Si aciertas 2 veces, ¡ganas!</p>
              <div className="mb-3 text-center">
                <span className="text-xs text-violet-300/70">Aciertos: {game.bansheePoints ?? 0}/2</span>
                <div className="flex gap-1 justify-center mt-1">
                  {[0, 1].map(i => (
                    <div key={i} className={`w-3 h-3 rounded-full ${(game.bansheePoints ?? 0) > i ? 'bg-violet-400' : 'bg-white/10'}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => (
                  <button key={p.uid} onClick={() => setBansheeTarget(bansheeTarget === p.uid ? null : p.uid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${bansheeTarget === p.uid ? 'border-violet-500 bg-violet-900/30' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-sm flex-shrink-0 overflow-hidden">
                      {p.photoURL ? <img src={p.photoURL} alt="" className="w-full h-full object-cover" /> : p.name[0]}
                    </div>
                    <span className="font-medium">{p.name}</span>
                    {p.isAI && <Bot className="h-3.5 w-3.5 text-cyan-400" />}
                  </button>
                ))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Predecir
              </button>
            </div>
          )}

          {/* ── CAMBIAFORMAS (night 1) ────────────────────────────────────────── */}
          {isCambiaformas && !submitted && (
            <div className="bg-orange-900/20 border border-orange-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🎭</span>
                <h3 className="font-semibold text-orange-300">Cambiaformas — seguir un destino</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Elige a un jugador. Si ese jugador muere, adoptarás su rol para el resto de la partida.</p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-orange-500 bg-orange-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Seguir este destino
              </button>
            </div>
          )}

          {/* ── LÍDER DEL CULTO ───────────────────────────────────────────────── */}
          {isLiderCulto && !submitted && (
            <div className="bg-fuchsia-900/20 border border-fuchsia-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🕯️</span>
                <h3 className="font-semibold text-fuchsia-300">Líder del Culto — convertir</h3>
              </div>
              <p className="text-white/50 text-xs mb-2">Convierte a un jugador al culto. Si todos están en el culto, ¡ganas!</p>
              <p className="text-fuchsia-300/50 text-xs mb-4">Miembros del culto ({(game.cultMembers ?? []).length}): {(game.cultMembers ?? []).map(uid => (game.players ?? []).find(p => p.uid === uid)?.name).filter(Boolean).join(', ')}</p>
              <div className="space-y-2 mb-4">
                {alivePlayers
                  .filter(p => !(game.cultMembers ?? []).includes(p.uid))
                  .map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-fuchsia-500 bg-fuchsia-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Convertir al culto
              </button>
            </div>
          )}

          {/* ── PESCADOR ─────────────────────────────────────────────────────── */}
          {isPescador && !submitted && (
            <div className="bg-blue-900/20 border border-blue-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🎣</span>
                <h3 className="font-semibold text-blue-300">Pescador — barca de supervivencia</h3>
              </div>
              <p className="text-white/50 text-xs mb-2">Mete a un jugador en tu barca. Si pescas a un lobo, <strong className="text-red-300">mueres</strong>. Si todos en la barca son inocentes, ¡ganáis!</p>
              <p className="text-blue-300/50 text-xs mb-4">En la barca: {(game.pescadorBoat ?? []).map(uid => (game.players ?? []).find(p => p.uid === uid)?.name).filter(Boolean).join(', ') || 'Nadie aún'}</p>
              <div className="space-y-2 mb-4">
                {alivePlayers
                  .filter(p => !(game.pescadorBoat ?? []).includes(p.uid))
                  .map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-blue-500 bg-blue-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Pescar
              </button>
            </div>
          )}

          {/* ── VAMPIRO ───────────────────────────────────────────────────────── */}
          {isVampiro && !submitted && (
            <div className="bg-red-950/30 border border-red-700/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🧛</span>
                <h3 className="font-semibold text-red-300">Vampiro — mordisco</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Muerdes a un jugador. Tras 3 mordiscos al mismo jugador, muere. Mata 3 jugadores y ganas.</p>
              <div className="mb-3 text-xs text-red-300/60 space-y-1">
                {Object.entries(game.vampiroBites ?? {}).map(([uid, bites]) => {
                  const p = (game.players ?? []).find(q => q.uid === uid);
                  return p ? <div key={uid}>🩸 {p.name}: {bites}/3 mordiscos</div> : null;
                })}
              </div>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-red-700 bg-red-950/40'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Morder
              </button>
            </div>
          )}

          {/* ── HADA BUSCADORA ────────────────────────────────────────────────── */}
          {isHadaBuscadora && !submitted && (
            <div className="bg-pink-900/20 border border-pink-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🧚</span>
                <h3 className="font-semibold text-pink-300">Hada Buscadora — encontrar al Hada</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Elige a un jugador. Si es el Hada Durmiente, os encontráis y ganáis juntas si sois las últimas vivas.</p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-pink-500 bg-pink-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Buscar al Hada
              </button>
            </div>
          )}

          {/* ── MÉDICO FORENSE ──────────────────────────────────────────────── */}
          {isForense && !submitted && (
            <div className="bg-teal-900/20 border border-teal-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🔬</span>
                <h3 className="font-semibold text-teal-300">Médico Forense — examinar cadáver</h3>
              </div>
              <p className="text-white/50 text-xs mb-3">Elige a un jugador eliminado para descubrir su rol.</p>
              {(game.forenseResults ?? {})[userId] && (
                <div className="mb-3 p-3 bg-teal-900/30 border border-teal-500/30 rounded-xl text-teal-200 text-sm">
                  🧬 Último análisis: <strong>{(game.forenseResults ?? {})[userId]}</strong>
                </div>
              )}
              <div className="space-y-2 mb-4">
                {(game.eliminatedHistory ?? []).map(h => (
                  <button key={h.uid} onClick={() => setSelectedTarget(h.uid)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedTarget === h.uid ? 'border-teal-400 bg-teal-900/40' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                    <span className="text-lg">💀</span>
                    <span className="font-medium">{h.name}</span>
                    <span className="text-white/40 text-xs ml-auto">Ronda {h.round}</span>
                  </button>
                ))}
                {(game.eliminatedHistory ?? []).length === 0 && (
                  <p className="text-white/30 text-sm text-center py-3">No hay cadáveres que examinar aún.</p>
                )}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-teal-700 hover:bg-teal-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Examinar cadáver
              </button>
            </div>
          )}

          {/* ── SABOTEADOR ──────────────────────────────────────────────────── */}
          {isSaboteador && !submitted && (
            <div className="bg-orange-900/20 border border-orange-400/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">💣</span>
                <h3 className="font-semibold text-orange-300">Saboteador — anular un voto</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">El jugador que elijas no podrá votar mañana.</p>
              <div className="space-y-2 mb-4">
                {alivePlayers.map(p => playerCard(p, selectedTarget === p.uid, () => setSelectedTarget(p.uid), 'border-orange-500 bg-orange-900/30'))}
              </div>
              <button onClick={handleSubmit} disabled={!canSubmit}
                className="w-full bg-orange-700 hover:bg-orange-600 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-colors">
                Sabotear voto
              </button>
            </div>
          )}

          {/* ── ILUMINADO (passive reveal) ───────────────────────────────────── */}
          {isIluminado && !submitted && (() => {
            const wolfUid = (game.iluminadoReveal ?? {})[userId];
            const wolfPlayer = wolfUid ? (game.players ?? []).find(p => p.uid === wolfUid) : null;
            return (
              <div className="bg-yellow-900/20 border border-yellow-400/30 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">💡</span>
                  <h3 className="font-semibold text-yellow-300">Tu visión de esta noche</h3>
                </div>
                {wolfPlayer ? (
                  <div className="mt-2 p-4 bg-red-900/30 border border-red-500/30 rounded-xl">
                    <p className="text-white/60 text-xs mb-2">Los astros te han revelado un lobo:</p>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🐺</span>
                      <span className="font-bold text-red-300 text-lg">{wolfPlayer.name}</span>
                    </div>
                    <p className="text-white/40 text-xs mt-2">Úsalo con sabiduría — si los señalas directamente, los lobos irán a por ti.</p>
                  </div>
                ) : (
                  <p className="text-white/40 text-sm">No hay visión disponible esta noche.</p>
                )}
                <button onClick={handleAutoSkip} className="w-full mt-4 bg-yellow-700/60 hover:bg-yellow-600/60 text-white font-bold py-3 rounded-xl transition-colors">
                  Entendido
                </button>
              </div>
            );
          })()}

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

          {/* ── ESPÍA ────────────────────────────────────────────────────────── */}
          {isEspia && !submitted && (
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🕵️</span>
                <h3 className="font-semibold text-cyan-300">El Espía</h3>
              </div>
              {!espiaViewActive ? (
                <>
                  <p className="text-white/50 text-xs mb-5">
                    {game.espiaUsed
                      ? 'Ya usaste tu habilidad de espionaje. Observas en silencio.'
                      : 'Puedes activar tu espionaje una sola vez y escuchar el chat de los lobos esta noche (solo lectura).'}
                  </p>
                  <div className="space-y-2">
                    {!game.espiaUsed && (
                      <button onClick={() => setEspiaViewActive(true)}
                        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-colors">
                        🔍 Activar espionaje
                      </button>
                    )}
                    <button onClick={handleAutoSkip}
                      className="w-full bg-white/10 hover:bg-white/15 border border-white/20 text-white/70 text-sm py-2.5 rounded-xl transition-colors">
                      {game.espiaUsed ? 'Confirmar' : 'Pasar esta noche'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-cyan-300/70 text-xs mb-3">📡 Interceptando el chat de lobos en tiempo real...</p>
                  <div className="bg-black/40 rounded-xl mb-4 p-3 min-h-16 max-h-40 overflow-y-auto space-y-1">
                    {wolfMsgsForEspia.length === 0
                      ? <p className="text-white/30 text-xs text-center pt-2">Los lobos aún no han hablado...</p>
                      : wolfMsgsForEspia.map(m => (
                          <p key={m.id} className="text-xs text-white/70">
                            <span className="text-red-400 font-medium">{m.name}:</span> {m.text}
                          </p>
                        ))
                    }
                  </div>
                  <button onClick={handleSubmit}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-colors">
                    Confirmar espionaje
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── ALQUIMISTA ───────────────────────────────────────────────────── */}
          {myRole === 'Alquimista' && !submitted && (
            <div className="bg-lime-900/20 border border-lime-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">⚗️</span>
                <h3 className="font-semibold text-lime-300">El Alquimista</h3>
              </div>
              <p className="text-white/50 text-xs mb-4">Cada noche destila una poción aleatoria. Sabrás el resultado al amanecer.</p>
              <div className="bg-black/30 rounded-xl p-4 mb-4 text-center">
                <div className="animate-spin inline-block text-3xl mb-2">⚗️</div>
                <p className="text-lime-300/60 text-sm">Preparando la poción de esta noche...</p>
              </div>
              <button onClick={handleAutoSkip}
                className="w-full bg-lime-700/50 hover:bg-lime-600/50 text-white font-bold py-3 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Chivo Expiatorio, Cazador, Alcalde: generic passive */}
          {['Chivo Expiatorio', 'Cazador', 'Alcalde'].includes(myRole) && !submitted && (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-8 text-center">
              <div className="mb-3 flex justify-center">
                <img src={getRoleIcon(myRole)} alt={myRole} className="w-16 h-16 object-cover rounded-xl shadow-md" />
              </div>
              <h3 className="font-semibold text-white/80 mb-2">{ROLES[myRole]?.name ?? myRole}</h3>
              <p className="text-white/40 text-sm mb-6">{ROLES[myRole]?.description}</p>
              <button onClick={handleAutoSkip}
                className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Passive info panel for new roles */}
          {(['Licántropo', 'Leprosa', 'Maldito', 'Hombre Ebrio', 'Príncipe', 'Alborotadora',
            'Verdugo', 'Hada Durmiente', 'Hada Buscadora', 'Ángel Resucitador', 'Vigía',
            'Vampiro', 'Banshee', 'Cambiaformas', 'Virginia Woolf', 'Sirena del Río',
            'Silenciadora', 'Líder del Culto', 'Pescador', 'Doctor', 'Anciana Líder',
            'Cría de Lobo', 'Bruja'].includes(myRole) &&
            !isNightRole && !submitted) && (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-5">
              <div className="mb-3 flex gap-2 items-center">
                <span className="text-2xl">{ROLES[myRole]?.emoji ?? '?'}</span>
                <h3 className="font-semibold text-white/80">{myRole}</h3>
              </div>
              {myRole === 'Verdugo' && game.verdugos?.[userId] && (
                <div className="mb-3 p-3 bg-red-950/30 border border-red-700/30 rounded-xl text-xs">
                  <p className="text-red-300 font-semibold mb-1">Tu objetivo secreto:</p>
                  <p className="text-white font-bold text-base">{(game.players ?? []).find(p => p.uid === game.verdugos![userId])?.name ?? '?'}</p>
                  <p className="text-white/40 mt-1">Si el pueblo lo lincha, ¡ganas tú solo!</p>
                </div>
              )}
              {myRole === 'Hada Durmiente' && game.hadaLinked && (
                <div className="mb-3 p-3 bg-pink-950/30 border border-pink-700/30 rounded-xl text-xs text-pink-300">
                  ✨ ¡El Hada Buscadora te encontró! Ganáis si sois las dos últimas vivas.
                </div>
              )}
              {myRole === 'Vigía' && game.vigiaUsed && game.vigiaKnowsWolves && (
                <div className="mb-3 p-3 bg-indigo-950/30 border border-indigo-700/30 rounded-xl text-xs text-indigo-300">
                  🔭 Ya usaste tu guardia. Los lobos son:
                  {(game.players ?? []).filter(p => p.isAlive && (game.roles?.[p.uid] === 'Lobo' || game.roles?.[p.uid] === 'Lobo Blanco' || game.roles?.[p.uid] === 'Cría de Lobo')).map(p => (
                    <span key={p.uid} className="ml-1 font-bold">{p.name}</span>
                  ))}
                </div>
              )}
              {myRole === 'Banshee' && (
                <div className="mb-3 p-3 bg-violet-950/30 border border-violet-700/30 rounded-xl text-xs text-violet-300">
                  Aciertos: {game.bansheePoints ?? 0}/2. Has actuado esta noche.
                </div>
              )}
              <p className="text-white/40 text-sm mb-4">{ROLES[myRole]?.description}</p>
              <button onClick={handleAutoSkip} className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-colors">
                Confirmar
              </button>
            </div>
          )}

          {/* Default: Aldeano / other non-night roles */}
          {!isNightRole && !isEspia &&
            !['Niña', 'Gemelas', 'Hermanos', 'Médium', 'Ángel', 'Antiguo', 'Pícaro', 'Juez', 'Oso',
              'Chivo Expiatorio', 'Alquimista', 'Espía', 'Cazador', 'Alcalde',
              'Licántropo', 'Leprosa', 'Maldito', 'Hombre Ebrio', 'Príncipe', 'Alborotadora',
              'Verdugo', 'Hada Durmiente', 'Ángel Resucitador', 'Vigía', 'Cría de Lobo', 'Bruja'].includes(myRole) &&
            !submitted && (
              <div className="bg-black/40 border border-white/10 rounded-2xl p-8 text-center">
                <div className="text-6xl mb-4">😴</div>
                <h3 className="font-semibold text-white/70 mb-2">El pueblo duerme</h3>
                <p className="text-white/40 text-sm mb-4">No tienes acción nocturna. Descansa mientras las sombras actúan...</p>
                {autoSkipCountdown !== null && (
                  <p className="text-amber-400/70 text-xs mb-4">
                    Durmiendo automáticamente en {autoSkipCountdown}s...
                  </p>
                )}
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
      <EmoteBar gameId={gameId} userId={userId} userName={userName} />
    </div>
  );
}
