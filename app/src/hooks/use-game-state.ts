
"use client";

import { useEffect, useState, useMemo } from 'react';
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

// Helper to safely get milliseconds from either a Timestamp object or a plain object
const getMillis = (timestamp: any): number => {
  if (!timestamp) return 0;
  if (timestamp instanceof Timestamp) {
    return timestamp.toMillis();
  }
  // It's a plain object from JSON serialization
  if (typeof timestamp === 'object' && timestamp.seconds !== undefined && timestamp.nanoseconds !== undefined) {
    return timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000;
  }
  // It might be a Date object already if converted somewhere
  if (timestamp instanceof Date) {
      return timestamp.getTime();
  }
  // It might be an ISO string
  if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
          return date.getTime();
      }
  }
  return 0; // Return 0 for any other invalid format
};

export const useGameState = (gameId: string) => {
  const { firestore } = useFirebase();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [wolfMessages, setWolfMessages] = useState<ChatMessage[]>([]);
  const [fairyMessages, setFairyMessages] = useState<ChatMessage[]>([]);
  const [twinMessages, setTwinMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gameRef = useMemoFirebase(() => {
    if (!gameId || !firestore) return null;
    return doc(firestore, 'games', gameId);
  }, [gameId, firestore]);

  useEffect(() => {
    if (!gameRef) {
        setLoading(false);
        if (!gameId) setError("No game ID provided.");
        else setError("Cargando sesión de Firebase...");
        return;
    };

    setLoading(true);

    const unsubscribeGame = onSnapshot(gameRef, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const gameData = { ...snapshot.data() as Game, id: snapshot.id };

        setGame(gameData);
        setPlayers([...gameData.players].sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt)));
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
  }, [gameId, firestore, gameRef]);

  return { game, players, events, messages, wolfMessages, fairyMessages, twinMessages, loading, error };
};
