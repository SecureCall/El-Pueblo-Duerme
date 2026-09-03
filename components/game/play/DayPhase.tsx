'use client';

import { useState, useEffect, useRef } from 'react';
import { GameState, Player } from './GamePlay';
import { Sun, Send, Vote, Skull, Bot, Timer, Scale, UserPlus, Check } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import {
  collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, limit,
} from 'firebase/firestore';
import { ROLES } from './roles';
import { getRoleIcon } from './roleIcons';
import { useNarrator } from '@/hooks/useNarrator';
import { sendFriendRequest } from '@/lib/firebase/friends';
import { submitReport } from '@/lib/firebase/reports';
import { EmoteBar } from './EmoteBar';
import { VoiceChat } from './VoiceChat';

function computeDayDuration(alivePlayers: number): number {
  // 10s per alive player, min 60s, max 120s  (noche dura 90s → proporcional)
  return Math.min(120, Math.max(60, alivePlayers * 10));
}

interface Props {
  game: GameState;
  gameId: string;
  myRole: string;
  me?: Player;
  userId: string;
  userName: string;
  isHost: boolean;
  onVote: (targetUid: string) => Promise<void>;
  onJuezSecondVote: () => Promise<void>;
  onAlborotadoraFight: (p1: string, p2: string) => Promise<void>;
  votesFromSub?: Record<string, string>;
  onTimerEnd: () => void;
}

interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
}

type ChatTab = 'public' | 'ghost' | 'lovers' | 'hermanos';

export function DayPhase({ game, gameId, myRole, me, userId, userName, isHost, onVote, onJuezSecondVote, onAlborotadoraFight, votesFromSub = {}, onTimerEnd }: Props) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [ghostMsgs, setGhostMsgs] = useState<ChatMsg[]>([]);
  const [loversMsgs, setLoversMsgs] = useState<ChatMsg[]>([]);
  const [hermanosMsgs, setHermanosMsgs] = useState<ChatMsg[]>([]);
  const [msg, setMsg] = useState('');
  const [ghostMsg, setGhostMsg] = useState('');
  const [loversMsg, setLoversMsg] = useState('');
  const [hermanosMsg, setHermanosMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingGhost, setSendingGhost] = useState(false);
  const [sendingLovers, setSendingLovers] = useState(false);
  const [sendingHermanos, setSendingHermanos] = useState(false);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);
  const dayDurationRef = useRef(60);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [chatTab, setChatTab] = useState<ChatTab>('public');
  const timerEndFired = useRef(false);
  const onTimerEndRef = useRef(onTimerEnd);
  const chatRef = useRef<HTMLDivElement>(null);
  const voteNarratedRound = useRef<number>(-1);
  const dangerNarratedRound = useRef<number>(-1);
  const { interruptWith, AUDIO_FILES } = useNarrator();

  useEffect(() => { onTimerEndRef.current = onTimerEnd; }, [onTimerEnd]);

  const dayVotes = votesFromSub;

  const meAlive = me?.isAlive ?? false;
  const alivePlayers = (game.players ?? []).filter(p => p.isAlive);
  const eliminatedNight = game.dayEliminatedUid
    ? game.players?.find(p => p.uid === game.dayEliminatedUid)
    : null;

  const isMedium = myRole === 'Médium';
  const isDead = !meAlive;
  const canSeeGhostChat = isMedium || isDead;
  const lovers = game.lovers ?? null;
  const isLover = lovers ? (lovers[0] === userId || lovers[1] === userId) : false;
  const isHermanos = myRole === 'Hermanos';
  const isJuez = myRole === 'Juez' && meAlive;
  const isAlquimista = myRole === 'Alquimista';
  const voteBanned = game.voteBanned ?? [];
  const myVoteBanned = voteBanned.includes(userId) || game.saboteadorBan === userId;
  const isSilenced = (game.silencedPlayers ?? []).includes(userId);

  const elapsed = dayDurationRef.current - secondsLeft;
  const isForzadaActive = game.currentEvent?.mechanical === 'forceConfession'
    && elapsed >= 0 && elapsed < 20;
  const confessorPlayer = isForzadaActive
    ? (game.players ?? []).find(p => p.uid === game.confessionUid) ?? null
    : null;
  const amIConfessor = isForzadaActive && game.confessionUid === userId;
  const confessionCountdown = Math.max(0, 20 - elapsed);
  const isAlborotadora = myRole === 'Alborotadora' && meAlive && !game.alborotadoraUsed;
  const [alborotadoraStep, setAlborotadoraStep] = useState<0 | 1>(0);
  const [sentFriendReqs, setSentFriendReqs] = useState<Set<string>>(new Set());
  const [reportedPlayers, setReportedPlayers] = useState<Set<string>>(new Set());

  const addFriend = async (e: React.MouseEvent, targetUid: string) => {
    e.stopPropagation();
    await sendFriendRequest(userId, targetUid);
    setSentFriendReqs(prev => new Set(prev).add(targetUid));
  };
  const [alborotadoraFighters, setAlborotadoraFighters] = useState<string[]>([]);
  const isVerdugo = myRole === 'Verdugo';
  const verdugoTarget = isVerdugo ? (game.players ?? []).find(p => p.uid === game.verdugos?.[userId]) : null;
  const isBanshee = myRole === 'Banshee' && meAlive;
  const [bansheePick, setBansheePick] = useState<string | null>(null);
  const [bansheeSubmitted, setBansheeSubmitted] = useState(false);

  const submitBansheePrediction = async (targetUid: string) => {
    if (bansheeSubmitted) return;
    setBansheeSubmitted(true);
    try {
      const response = await fetch('/api/banshee-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, targetUid, round: game.roundNumber }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'No se pudo enviar la predicción');
      }
    } catch (e) {
      console.error('[Banshee] prediction write failed:', e);
      setBansheeSubmitted(false);
    }
  };

  // Hermanos chat
  useEffect(() => {
    if (!isHermanos) return;
    const q = query(collection(db, gameId ? `games/${gameId}/hermanosChat` : 'invalid'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, (snap: any) => {
      setHermanosMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg)));
      if (chatTab === 'hermanos') setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, isHermanos]);

  // Tabs available
  const availableTabs: ChatTab[] = ['public'];
  if (canSeeGhostChat) availableTabs.push('ghost');
  if (isLover) availableTabs.push('lovers');
  if (isHermanos) availableTabs.push('hermanos');

  // Public chat
  useEffect(() => {
    const q = query(collection(db, 'games', gameId, 'publicChat'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, (snap: any) => {
      setMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg)));
      if (chatTab === 'public') setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  // Ghost chat (Médium reads, dead players write)
  useEffect(() => {
    if (!canSeeGhostChat) return;
    const q = query(collection(db, 'games', gameId, 'ghostChat'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, (snap: any) => {
      setGhostMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg)));
      if (chatTab === 'ghost') setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, canSeeGhostChat]);

  // Lovers chat (only the pair)
  useEffect(() => {
    if (!isLover) return;
    const q = query(collection(db, 'games', gameId, 'loversChat'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnapshot(q, (snap: any) => {
      setLoversMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg)));
      if (chatTab === 'lovers') setTimeout(() => chatRef.current?.scrollTo({ top: 9999 }), 50);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, isLover]);
