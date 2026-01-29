import { db } from './config';
import { 
  collection, doc, setDoc, getDoc, updateDoc,
  onSnapshot, query, where, serverTimestamp 
} from 'firebase/firestore';

export const createGame = async (userId: string, userName: string) => {
  const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const gameId = doc(collection(db, 'games')).id;
  
  const gameData = {
    id: gameId,
    code: gameCode,
    phase: 'lobby',
    turnNumber: 0,
    players: {},
    createdBy: userId,
    createdAt: serverTimestamp(),
  };
  
  const gameRef = doc(db, 'games', gameId);
  await setDoc(gameRef, gameData);
  
  // Crear jugador creador
  await joinGame(gameId, userId, userName);
  
  return { gameId, gameCode };
};

export const joinGame = async (gameId: string, userId: string, userName: string) => {
  const playerRef = doc(db, 'games', gameId, 'players', userId);
  await setDoc(playerRef, {
    id: userId,
    uid: userId,
    displayName: userName,
    role: 'aldeano', // Temporal, luego se asignará aleatorio
    isAlive: true,
  });
};
