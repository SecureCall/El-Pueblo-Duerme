
"use client";

import { useEffect, useState, useMemo } from 'react';
import { 
  doc, 
  collection,
  query,
  where,
  orderBy,
  onSnapshot, 
  type DocumentData, 
  type DocumentSnapshot, 
  type FirestoreError,
} from 'firebase/firestore';
import type { Game, Player, GameEvent, ChatMessage } from '@/types';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


export const useGameState = (gameId: string) => {
  const { firestore } = useFirebase();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
        return;
    };

    setLoading(true);

    const unsubscribeGame = onSnapshot(gameRef, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const gameData = { ...snapshot.data() as Game, id: snapshot.id };
        setGame(gameData);
        setPlayers(gameData.players.sort((a, b) => a.joinedAt.toMillis() - b.joinedAt.toMillis()));
        setEvents(gameData.events?.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()) || []);
        // Only get messages for the current round
        setMessages(gameData.chatMessages?.filter(m => m.round === gameData.currentRound) || []);
        setError(null);
      } else {
        setError('Partida no encontrada.');
        setGame(null);
        setPlayers([]);
        setEvents([]);
        setMessages([]);
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

  return { game, players, events, messages, loading, error };
};
