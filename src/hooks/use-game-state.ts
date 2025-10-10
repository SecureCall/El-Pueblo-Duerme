
"use client";

import { useEffect, useState } from 'react';
import { 
  doc, 
  onSnapshot, 
  type DocumentData, 
  type DocumentSnapshot, 
  type FirestoreError,
} from 'firebase/firestore';
import type { Game, Player, GameEvent } from '@/types';
import { useFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


export const useGameState = (gameId: string) => {
  const { firestore } = useFirebase();
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId || !firestore) {
        setLoading(false);
        if (!gameId) setError("No game ID provided.");
        return;
    };

    setLoading(true);

    const gameRef = doc(firestore, 'games', gameId);
    const unsubscribeGame = onSnapshot(gameRef, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const gameData = { ...snapshot.data() as Game, id: snapshot.id };
        setGame(gameData);
        setPlayers(gameData.players.sort((a, b) => a.joinedAt.toMillis() - b.joinedAt.toMillis()));
        setEvents(gameData.events?.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()) || []);
        setError(null);
      } else {
        setError('Partida no encontrada.');
        setGame(null);
        setPlayers([]);
        setEvents([]);
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
  }, [gameId, firestore]);

  return { game, players, events, loading, error };
};
