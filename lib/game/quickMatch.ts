import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { BOT_NAMES, assignBotType } from '@/lib/bots/botSystem';
import { generateRoomName } from '@/lib/roomNames';

function wolfCount(players: number) {
  if (players <= 6) return 1;
  if (players <= 9) return 2;
  if (players <= 12) return 3;
  return Math.floor(players / 4);
}

export async function createQuickMatch(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}): Promise<string> {
  const playerName = user.displayName || user.email?.split('@')[0] || 'Jugador';
  const totalPlayers = 6;
  const botCount = totalPlayers - 1;

  const usedNames = new Set<string>();
  const bots = Array.from({ length: botCount }, () => {
    const available = BOT_NAMES.filter(n => !usedNames.has(n));
    const name = available[Math.floor(Math.random() * available.length)] ?? `Bot${Math.random().toString(36).slice(2, 5)}`;
    usedNames.add(name);
    return {
      uid: `bot_${Math.random().toString(36).slice(2, 10)}`,
      name,
      photoURL: '',
      isHost: false,
      isAlive: true,
      role: null,
      isAI: true,
      botType: assignBotType(),
    };
  });

  const players = [
    {
      uid: user.uid,
      name: playerName,
      photoURL: user.photoURL ?? '',
      isHost: true,
      isAlive: true,
      role: null,
    },
    ...bots,
  ];

  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const docRef = await addDoc(collection(db, 'games'), {
    name: generateRoomName(),
    hostUid: user.uid,
    hostName: playerName,
    code,
    maxPlayers: totalPlayers,
    wolves: wolfCount(totalPlayers),
    isPublic: false,
    fillWithAI: true,
    juryVote: false,
    gameMode: 'casual',
    specialRoles: ['Vidente', 'Doctor'],
    playerCount: players.length,
    status: 'lobby',
    phase: 'lobby',
    players,
    quickMatch: true,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}
