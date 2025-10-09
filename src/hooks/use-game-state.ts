"use client";

import { useEffect, useState } from 'react';
import { doc, onSnapshot, collection, query, where, QuerySnapshot, DocumentData, DocumentSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Game, Player, GameEvent } from '@/types';

export const useGameState = (gameId: string) => {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) {
        setLoading(false);
        setError("No game ID provided.");
        return;
    };

    setLoading(true);

    const gameRef = doc(db, 'games', gameId);
    const unsubscribeGame = onSnapshot(gameRef, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        setGame(snapshot.data() as Game);
        setError(null);
      } else {
        setError('Partida no encontrada.');
        setGame(null);
        setPlayers([]);
      }
      setLoading(false);
    }, (err) => {
        console.error("Error fetching game:", err);
        setError("Error al cargar la partida.");
        setLoading(false);
    });

    const playersQuery = query(collection(db, 'players'), where('gameId', '==', gameId));
    const unsubscribePlayers = onSnapshot(playersQuery, (snapshot: QuerySnapshot<DocumentData>) => {
      const playersData = snapshot.docs.map(doc => doc.data() as Player);
      setPlayers(playersData.sort((a, b) => a.joinedAt.toMillis() - b.joinedAt.toMillis()));
    }, (err) => {
        console.error("Error fetching players:", err);
        setError("Error al cargar los jugadores.");
    });
    
    const eventsQuery = query(
        collection(db, 'game_events'), 
        where('gameId', '==', gameId),
        orderBy('createdAt', 'asc') // Fetch in ascending order
    );
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
        const eventsData = snapshot.docs.map(doc => doc.data() as GameEvent);
        setEvents(eventsData);
    }, (err) => {
        console.error("Error fetching events:", err);
    });


    return () => {
      unsubscribeGame();
      unsubscribePlayers();
      unsubscribeEvents();
    };
  }, [gameId]);

  return { game, players, events, loading, error };
};
