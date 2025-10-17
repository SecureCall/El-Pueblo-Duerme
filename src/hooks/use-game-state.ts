
"use client";

import { useEffect, useState } from 'react';
import { 
  doc, 
  onSnapshot, 
  type DocumentData, 
  type DocumentSnapshot, 
  type FirestoreError,
  Timestamp,
} from 'firebase/firestore';
import type { Game, Player, GameEvent, ChatMessage } from '@/types';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useGameSession } from './use-game-session';


const getMillis = (timestamp: any): number => {
  if (!timestamp) return 0;
  if (timestamp instanceof Timestamp) {
    return timestamp.toMillis();
  }
  if (typeof timestamp === 'object' && timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
    return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
  }
  if (timestamp instanceof Date) {
      return timestamp.getTime();
  }
  if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
          return date.getTime();
      }
  }
  return 0;
};

interface InitialState {
    initialGame: Game;
    initialPlayers: Player[];
    initialCurrentPlayer: Player;
    initialEvents: GameEvent[];
    initialMessages: ChatMessage[];
    initialWolfMessages: ChatMessage[];
    initialFairyMessages: ChatMessage[];
    initialTwinMessages: ChatMessage[];
}

export const useGameState = (gameId: string, initialState?: InitialState) => {
  const { firestore } = useFirebase();
  const { userId } = useGameSession();

  const [game, setGame] = useState<Game | null>(initialState?.initialGame ?? null);
  const [players, setPlayers] = useState<Player[]>(initialState?.initialPlayers ?? []);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(initialState?.initialCurrentPlayer ?? null);
  const [events, setEvents] = useState<GameEvent[]>(initialState?.initialEvents ?? []);
  const [messages, setMessages] = useState<ChatMessage[]>(initialState?.initialMessages ?? []);
  const [wolfMessages, setWolfMessages] = useState<ChatMessage[]>(initialState?.initialWolfMessages ?? []);
  const [fairyMessages, setFairyMessages] = useState<ChatMessage[]>(initialState?.initialFairyMessages ?? []);
  const [twinMessages, setTwinMessages] = useState<ChatMessage[]>(initialState?.initialTwinMessages ?? []);
  const [loading, setLoading] = useState(!initialState);
  const [error, setError] = useState<string | null>(null);

  const gameRef = useMemoFirebase(() => {
    if (!gameId || !firestore) return null;
    return doc(firestore, 'games', gameId);
  }, [gameId, firestore]);

  useEffect(() => {
    if (!gameRef) {
        if (!initialState) {
            setLoading(false);
            if (!gameId) setError("No game ID provided.");
            else setError("Cargando sesión de Firebase...");
        }
        return;
    };

    if (!initialState) setLoading(true);

    const unsubscribeGame = onSnapshot(gameRef, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const gameData = { ...snapshot.data() as Game, id: snapshot.id };

        setGame(gameData);
        
        const sortedPlayers = [...gameData.players].sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
        setPlayers(sortedPlayers);
        setCurrentPlayer(sortedPlayers.find(p => p.userId === userId) || null);

        setEvents([...(gameData.events || [])].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)));
        setMessages(
          (gameData.chatMessages || [])
            .sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt))
        );
         setWolfMessages(
          (gameData.wolfChatMessages || [])
            .filter(m => m.round === gameData.currentRound)
            .sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt))
        );
        setFairyMessages(
          (gameData.fairyChatMessages || [])
            .sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt))
        );
        setTwinMessages(
          (gameData.twinChatMessages || [])
            .sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt))
        );

        setError(null);
      } else {
        setError('Partida no encontrada.');
        setGame(null);
        setPlayers([]);
        setCurrentPlayer(null);
        setEvents([]);
        setMessages([]);
        setWolfMessages([]);
        setFairyMessages([]);
        setTwinMessages([]);
      }
      setLoading(false);
    }, (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: gameRef.path,
        });
        setError("Error al cargar la partida. Permisos insuficientes.");
        setLoading(false);
        errorEmitter.emit('permission-error', contextualError);
    });

    return () => {
      unsubscribeGame();
    };
  }, [gameId, firestore, gameRef, userId, initialState]);

  return { game, players, currentPlayer, events, messages, wolfMessages, fairyMessages, twinMessages, loading, error };
};
