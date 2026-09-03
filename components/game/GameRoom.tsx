'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { db } from '@/lib/firebase/config';
import {
  doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, serverTimestamp,
  collection, addDoc, query, orderBy, limit, onSnapshot as onSnap, deleteDoc,
  getDoc,
} from 'firebase/firestore';
import { Copy, Crown, LogOut, Send, Users, Loader2, Bot, Share2, MessageCircle, Facebook, Link, Check, UserPlus } from 'lucide-react';
import { useNarrator, waitForAudio } from '@/hooks/useNarrator';
import { useAudio } from '@/app/providers/AudioProvider';
import { FriendsPanel } from '@/components/friends/FriendsPanel';
import { sendFriendRequest } from '@/lib/firebase/friends';
import { xpToLevel, levelEmoji } from '@/lib/firebase/xp';
import { BOT_NAMES, assignBotType, type BotType } from '@/lib/bots/botSystem';
import { getBehaviorProfile } from '@/lib/bots/playerStats';

interface Player {
  uid: string; name: string; photoURL: string; isHost: boolean;
  isAlive: boolean; role: string | null; isAI?: boolean; botType?: string;
  level?: number; lastSeen?: number;
}
interface GameData {
  name: string; code: string; hostUid: string; hostName: string; maxPlayers: number;
  wolves: number; isPublic: boolean; fillWithAI: boolean; juryVote: boolean;
  specialRoles: string[]; playerCount: number; status: string; phase: string; players: Player[];
}
interface ChatMsg { id: string; senderId: string; senderName: string; text: string; createdAt: any; }

function biasedBotType(aggressionLevel: 'fast'|'medium'|'slow', i: number): BotType {
  const pools: Record<string, BotType[]> = {
    fast: ['callado','callado','listo','acusador','caotico'],
    slow: ['acusador','acusador','caotico','listo','callado'],
    medium: ['callado','acusador','listo','caotico','acusador'],
  };
  return pools[aggressionLevel][i % pools[aggressionLevel].length];
}
function generateAIPlayers(current: Player[], maxPlayers: number, aggressionLevel?: 'fast'|'medium'|'slow'): Player[] {
  const count = maxPlayers - current.length;
  if (count <= 0) return [];
  const used = new Set(current.map(p => p.name));
  const available = BOT_NAMES.filter(n => !used.has(n));
  return Array.from({ length: count }, (_, i) => ({
    uid: `ai_${Date.now()}_${i}`, name: available[i % available.length] ?? `Jugador ${i+1}`,
    photoURL: '', isHost: false, isAlive: true, role: null, isAI: true,
    botType: aggressionLevel ? biasedBotType(aggressionLevel, i) : assignBotType(),
  }));
}

export function GameRoom({ gameId }: { gameId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true); const [notFound, setNotFound] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]); const [msg, setMsg] = useState(''); const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false); const [showShare, setShowShare] = useState(false); const [linkCopied, setLinkCopied] = useState(false);
  const [retentionCountdown, setRetentionCountdown] = useState<number | null>(null); const retentionFiredRef = useRef(false); const chatRef = useRef<HTMLDivElement>(null);
  const { play, stop, AUDIO_FILES } = useNarrator(); const { playMusic } = useAudio(); const [introSkipped, setIntroSkipped] = useState(false); const salasPlayed = useRef(false);
  const [sentFriendReqs, setSentFriendReqs] = useState<Set<string>>(new Set());

  const addFriend = async (e: React.MouseEvent, targetUid: string) => { e.stopPropagation(); if (!user) return; await sendFriendRequest(user.uid, targetUid); setSentFriendReqs(prev => new Set(prev).add(targetUid)); };

  const kickPlayer = async (targetUid: string) => {
    if (!isHost || !game || targetUid === user?.uid) return;
    const target = game.players?.find(p => p.uid === targetUid); if (!target) return;
    try {
      const token = await user?.getIdToken(); if (!token) return;
      await fetch('/api/lobby-kick', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ gameId, targetUid }) });
    } catch (_) {}
  };

  useEffect(() => { if (salasPlayed.current) return; salasPlayed.current = true; play(AUDIO_FILES.salas); waitForAudio().then(() => playMusic('lobby')); }, []);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'games', gameId), (snap: any) => {
      if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
      const data = snap.data() as GameData; setGame(data); setLoading(false);
      if (data.status === 'playing') router.push(`/game/${gameId}/play`);
    }, () => { setNotFound(true); setLoading(false); }); return () => unsub();
  }, [gameId, router]);

  useEffect(() => {
    if (!game) return;
    const q = query(collection(db, 'games', gameId, 'lobbyChat'), orderBy('createdAt', 'asc'), limit(100));
    const unsub = onSnap(q, (snap: any) => { setMsgs(snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as ChatMsg))); setTimeout(() => chatRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 50); });
    return () => unsub();
  }, [game, gameId]);

  useEffect(() => {
    if (!user || !game) return;
    const already = game.players?.some(p => p.uid === user.uid); if (!already) {
      const resolvedName = user.displayName || user.email?.split('@')[0] || 'Jugador';
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        const xp = snap.exists() ? (snap.data().xp ?? 0) : 0;
        const newPlayer: Player = { uid: user.uid, name: resolvedName, photoURL: user.photoURL ?? '', isHost: false, isAlive: true, role: null, level: xpToLevel(xp), lastSeen: Date.now() };
        updateDoc(doc(db, 'games', gameId), { players: arrayUnion(newPlayer), playerCount: (game.playerCount ?? 1) + 1 }).catch(() => {});
      }).catch(() => {});
    }
  }, [user, game, gameId]);

  // Server-authoritative lobby heartbeat. Never replace the complete players array from a stale client snapshot.
  useEffect(() => {
    if (!user || !game || game.status !== 'lobby') return;
    let cancelled = false;
    const updatePresence = async () => {
      try {
        const token = await user.getIdToken(); if (!token || cancelled) return;
        await fetch('/api/lobby-presence', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ gameId }), credentials: 'include' });
      } catch (_) {}
    };
    updatePresence();
    const id = setInterval(updatePresence, 60000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user, game?.status, gameId]);

  const autoFillWithBots = async () => {
    if (!user || !game || retentionFiredRef.current || game.hostUid !== user.uid) return;
    retentionFiredRef.current = true;
    const realNow = (game.players ?? []).filter(p => !p.isAI); if (realNow.length >= 4) return;
    const targetTotal = Math.min(game.maxPlayers ?? 10, Math.max(6, realNow.length + 3)); const newBots = generateAIPlayers(realNow, targetTotal); if (!newBots.length) return;
    await updateDoc(doc(db, 'games', gameId), { players: [...realNow, ...newBots], playerCount: realNow.length + newBots.length, fillWithAI: true }).catch(() => {});
    setRetentionCountdown(null);
  };

  useEffect(() => {
    if (!user || !game || game.status !== 'lobby' || game.hostUid !== user.uid) return;
    const realCount = (game.players ?? []).filter(p => !p.isAI).length; if (realCount >= 4 || retentionFiredRef.current) return;
    const WARN_AT = 40000, FILL_AT = 60000, COUNTDOWN_SECS = 20;
    const warnTimer = setTimeout(() => setRetentionCountdown(COUNTDOWN_SECS), WARN_AT);
    const countdownTimer = setTimeout(() => { let c = COUNTDOWN_SECS - 1; const iv = setInterval(() => { setRetentionCountdown(prev => { if (prev === null || prev <= 1) { clearInterval(iv); return null; } return prev - 1; }); c--; if (c <= 0) clearInterval(iv); }, 1000); }, WARN_AT + 1000);
    const fillTimer = setTimeout(autoFillWithBots, FILL_AT);
    return () => { clearTimeout(warnTimer); clearTimeout(countdownTimer); clearTimeout(fillTimer); };
  }, [(game?.players ?? []).filter(p => !p.isAI).length, game?.status, user?.uid]);

  const sendMsg = async (e: React.FormEvent) => {
    e.preventDefault(); if (!msg.trim() || !user) return; setSending(true);
    await addDoc(collection(db, 'games', gameId, 'lobbyChat'), { senderId: user.uid, senderName: user.displayName || user.email?.split('@')[0] || 'Jugador', text: msg.trim(), createdAt: serverTimestamp() });
    setMsg(''); setSending(false);
  };

  const leaveGame = async () => {
    if (!user || !game) return;
    try {
      const token = await user.getIdToken(); if (!token) return;
      await fetch('/api/lobby-leave', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ gameId }), credentials: 'include' });
    } catch (_) {}
    router.push('/');
  };

  const getShareData = () => { const code = game?.code ?? ''; const url = typeof window !== 'undefined' ? window.location.href : ''; const text = `¡Únete a mi partida de El Pueblo Duerme! 🐺\nCódigo: ${code}\n${url}`; return { code, url, text }; };
  const handleShare = async () => { const { text, url } = getShareData(); if (navigator.share) { try { await navigator.share({ title: '¡Únete a El Pueblo Duerme!', text, url }); return; } catch (_) {} } setShowShare(v => !v); };
  const handleCopyLink = async () => { const { text } = getShareData(); await navigator.clipboard.writeText(text); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };
  useEffect(() => { const handleClickOutside = (e: MouseEvent) => { if (shareRef.current && !shareRef.current.contains(e.target as Node)) setShowShare(false); }; document.addEventListener('mousedown', handleClickOutside); return () => document.removeEventListener('mousedown', handleClickOutside); }, []);
  const skipIntro = () => { stop(); setIntroSkipped(true); playMusic('lobby'); };

  const startGame = async () => {
    if (!user || !game || game.hostUid !== user.uid) return;
    stop(); setStarting(true);
    try {
      const token = await user.getIdToken(); if (!token) throw new Error('No autenticado');
      const response = await fetch('/api/game-start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ gameId }), credentials: 'include' });
      if (!response.ok) throw new Error('No se pudo iniciar la partida');
    } catch (err) { console.error('Error starting game:', err); setStarting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#05080f]"><Loader2 className="h-10 w-10 animate-spin text-white/50" /></div>;
  if (notFound) return <div className="min-h-screen flex flex-col items-center justify-center bg-[#05080f] text-white gap-4"><p className="text-xl font-headline">Sala no encontrada</p><button onClick={() => router.push('/')} className="text... (truncated)