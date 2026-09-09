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
import { getPrivateGameState } from '@/lib/game/privateStateClient';

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
  const [privateRole, setPrivateRole] = useState<string | null>(myRole || null);
  const [wolfRoster, setWolfRoster] = useState<Array<{ uid: string; name: string }>>([]);
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

  const effectiveRole = privateRole || myRole;
  const round = game.roundNumber ?? 1;
  const subs = game.nightSubmissions ?? {};
  const alivePlayers = (game.players ?? []).filter(p => p.isAlive && p.uid !== userId);
  const allAlivePlayers = (game.players ?? []).filter(p => p.isAlive);

  useEffect(() => {
    let cancelled = false;
    getPrivateGameState(gameId).then(state => {
      if (cancelled) return;
      setPrivateRole(state.myRole);
      setWolfRoster(state.wolfRoster ?? []);
    }).catch(error => console.error('[NightPhase] private state unavailable', error));
    return () => { cancelled = true; };
  }, [gameId, round]);

  // Role flags
  const isWolf = effectiveRole === 'Lobo';
  const isLoboBlanco = effectiveRole === 'Lobo Blanco';
  const isCriaLobo = effectiveRole === 'Cría de Lobo';
  const isWolfTeam = isWolf || isLoboBlanco || isCriaLobo;
  const isSeer = effectiveRole === 'Vidente';
  const isWitch = effectiveRole === 'Hechicera';
  const isLoboBruja = effectiveRole === 'Bruja';
  const isCupido = effectiveRole === 'Cupido' && round === 1;
  const isGuardian = effectiveRole === 'Guardián';
  const isDoctor = effectiveRole === 'Doctor';
  const isFlautista = effectiveRole === 'Flautista';
  const isPerroLobo = effectiveRole === 'Perro Lobo' && round === 1;
  const isSalvaje = effectiveRole === 'Niño Salvaje' && round === 1;
  const isProfeta = effectiveRole === 'Profeta';
  const isNiña = effectiveRole === 'Niña';
  const isSacerdote = effectiveRole === 'Sacerdote';
  const isLadron = effectiveRole === 'Ladrón' && round === 1;
  const isAnciana = effectiveRole === 'Anciana Líder';
  const isAngelResucitador = effectiveRole === 'Ángel Resucitador' && !game.angelResucitadorUsed;
  const isSilenciadora = effectiveRole === 'Silenciadora';
  const isSirena = effectiveRole === 'Sirena del Río' && round === 1;
  const isVirginia = effectiveRole === 'Virginia Woolf' && round === 1;
  const isVigia = effectiveRole === 'Vigía' && !game.vigiaUsed;
  const isBanshee = effectiveRole === 'Banshee';
  const isCambiaformas = effectiveRole === 'Cambiaformas' && round === 1;
  const isLiderCulto = effectiveRole === 'Líder del Culto';
