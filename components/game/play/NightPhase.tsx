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
import { VoiceChat } from './VoiceChat';

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
  const [seerTarget2, setSeerTarget2] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const { play, AUDIO_FILES } = useNarrator();
  const isEspia = myRole === 'Espía';

  const round = game.roundNumber ?? 1;
  const subs = game.nightSubmissions ?? {};
  const alivePlayers = (game.players ?? []).filter(p => p.isAlive && p.uid !== userId);
  const allAlivePlayers = (game.players ?? []).filter(p => p.isAlive);

  const isWolf = myRole === 'Lobo';
  const isLoboBlanco = myRole === 'Lobo Blanco';
  const isCriaLobo = myRole === 'Cría de Lobo';
  const isWolfTeam = isWolf || isLoboBlanco || isCriaLobo;
  const isSeer = myRole === 'Vidente';
  const isWitch = myRole === 'Hechicera';
  const isLoboBruja = myRole === 'Bruja';
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

  const canSeeWolfChat = isWolfTeam || isLoboBruja;
  useEffect(() => {
    if (!canSeeWolfChat) return;
    const q = query(collection(db, 'games', gameId, 'wolfChat'), orderBy('createdAt', 'asc'), limit(50));
    const unsub = onSnapshot(q,
      (snap: any) => {
        setWolfMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
        setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
      },
      () => {}
    );
    return () => unsub();
  }, [canSeeWolfChat, gameId]);

  useEffect(() => {
    if (!isEspia || !espiaViewActive) return;
    const q = query(collection(db, 'games', gameId, 'wolfChat'), orderBy('createdAt', 'asc'), limit(50));
    const unsub = onSnapshot(q,
      (snap: any) => setWolfMsgsForEspia(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => unsub();
  }, [isEspia, espiaViewActive, gameId]);

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

  useEffect(() => {
    if (!narratorReady || submitted) return;
    if (isNightRole || isEspia) return;
    if (!me?.isAlive) { setSubmitted(true); return; }
    let seconds = 5;
    setAutoSkipCountdown(seconds);
    const interval = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(interval);
        setAutoSkipCountdown(null);
        onSubmitAction({ _skip: true }).then(() => setSubmitted(true)).catch(() => {});
      } else setAutoSkipCountdown(seconds);
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, submitted, narratorReady]);

  useEffect(() => {
    if (!narratorReady || submitted) return;
    if (!isNightRole && !isEspia) return;
    if (!me?.isAlive) { setSubmitted(true); return; }
    const timer = setTimeout(() => {
      if (!submitted) onSubmitAction({ _skip: true }).then(() => setSubmitted(true)).catch(() => {});
    }, 20000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, submitted, narratorReady]);

  const NIGHT_DURATION = 55;
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
    if (isSeer && selectedTarget) {
      action.seerTarget = selectedTarget;
      if (game.doubleSeerActive && seerTarget2 && seerTarget2 !== selectedTarget) action.seerTarget2 = seerTarget2;
    }
    if (isProfeta && selectedTarget) action.profetaTarget = selectedTarget;
    if (isWitch) {
      if (witchChoice === 'save') action.witchSave = true;
      if (witchChoice === 'poison' && selectedTarget) action.witchPoison = selectedTarget;
    }
    if (isLoboBruja && selectedTarget) action.brujaTarget = selectedTarget;
    if (isCupido && cupidTargets.length === 2) action.cupidTargets = cupidTargets;
    if (isGuardian && selectedTarget) action.guardianTarget = selectedTarget;
    if (isDoctor && selectedTarget) action.doctorTarget = selectedTarget;
    if (isFlautista && flautistaTargets.length === 2) action.flautistaTargets = flautistaTargets;
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
    try {
      await addDoc(collection(db, 'games', gameId, 'wolfChat'), {
        senderId: userId,
        senderName: userName,
        name: userName,
        text: wolfMsg.trim(),
        createdAt: serverTimestamp(),
      });
      setWolfMsg('');
    } finally {
      setSendingMsg(false);
    }
  };

  return null;
}
