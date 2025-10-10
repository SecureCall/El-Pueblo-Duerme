
"use client";

import { useEffect, useState } from 'react';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  type QuerySnapshot, 
  type DocumentData, 
  type DocumentSnapshot, 
  orderBy, 
  FirestoreError,
  collectionGroup
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
        setGame({ ...snapshot.data() as Game, id: snapshot.id });
        setError(null);
      } else {
        setError('Partida no encontrada.');
        setGame(null);
        setPlayers([]);
      }
      setLoading(false);
    }, (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: gameRef.path,
        });
        setError("Error al cargar la partida.");
        setLoading(false);
        errorEmitter.emit('permission-error', contextualError);
    });

    const playersQuery = query(
      collectionGroup(firestore, 'players'), 
      where('gameId', '==', gameId)
    );
    const unsubscribePlayers = onSnapshot(playersQuery, (snapshot: QuerySnapshot<DocumentData>) => {
      const playersData = snapshot.docs.map(doc => ({ ...doc.data() as Player, id: doc.id }));
      setPlayers(playersData.sort((a, b) => a.joinedAt.toMillis() - b.joinedAt.toMillis()));
    }, (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: `games/${gameId}/players`,
        });
        setError("Error al cargar los jugadores.");
        errorEmitter.emit('permission-error', contextualError);
    });
    
    const eventsQuery = query(
      collectionGroup(firestore, 'events'), 
      where('gameId', '==', gameId), 
      orderBy('createdAt', 'asc')
    );
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
        const eventsData = snapshot.docs.map(doc => ({ ...doc.data() as GameEvent, id: doc.id }));
        setEvents(eventsData);
    }, (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: `games/${gameId}/events`,
        });
        setError("Error al cargar los eventos de la partida.");
        errorEmitter.emit('permission-error', contextualError);
    });


    return () => {
      unsubscribeGame();
      unsubscribePlayers();
      unsubscribeEvents();
    };
  }, [gameId, firestore]);

  return { game, players, events, loading, error };
};
