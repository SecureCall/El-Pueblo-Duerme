
'use client';

import { useEffect, useState } from 'react';
import { 
  doc, 
  onSnapshot, 
  type DocumentData, 
  type DocumentSnapshot, 
  type FirestoreError,
} from 'firebase/firestore';
import type { Game, Player, GameEvent, ChatMessage } from '@/types';
import { useFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useGameSession } from './use-game-session';
import { getMillis } from '@/lib/utils';

interface GameState {
    game: Game | null;
    players: Player[];
    currentPlayer: Player | null;
    events: GameEvent[];
    messages: ChatMessage[];
    wolfMessages: ChatMessage[];
    fairyMessages: ChatMessage[];
    twinMessages: ChatMessage[];
    loversMessages: ChatMessage[];
    ghostMessages: ChatMessage[];
    loading: boolean;
    error: string | null;
}

const initialState: GameState = {
    game: null,
    players: [],
    currentPlayer: null,
    events: [],
    messages: [],
    wolfMessages: [],
    fairyMessages: [],
    twinMessages: [],
    loversMessages: [],
    ghostMessages: [],
    loading: true,
    error: null,
};

export const useGameState = (gameId: string) => {
  const { firestore } = useFirebase();
  const { userId } = useGameSession();
  
  const [game, setGame] = useState<Game | null>(initialState.game);
  const [players, setPlayers] = useState<Player[]>(initialState.players);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(initialState.currentPlayer);
  const [events, setEvents] = useState<GameEvent[]>(initialState.events);
  const [messages, setMessages] = useState<ChatMessage[]>(initialState.messages);
  const [wolfMessages, setWolfMessages] = useState<ChatMessage[]>(initialState.wolfMessages);
  const [fairyMessages, setFairyMessages] = useState<ChatMessage[]>(initialState.fairyMessages);
  const [twinMessages, setTwinMessages] = useState<ChatMessage[]>(initialState.twinMessages);
  const [loversMessages, setLoversMessages] = useState<ChatMessage[]>(initialState.loversMessages);
  const [ghostMessages, setGhostMessages] = useState<ChatMessage[]>(initialState.ghostMessages);
  const [loading, setLoading] = useState<boolean>(initialState.loading);
  const [error, setError] = useState<string | null>(initialState.error);

  // Effect 1: Subscribe to Firestore for state updates
  useEffect(() => {
    if (!firestore || !userId || !gameId) {
        setLoading(false);
        if(!gameId) setError("No se ha proporcionado un ID de partida.");
        return;
    };

    setLoading(true);
    const gameRef = doc(firestore, 'games', gameId);

    const unsubscribeGame = onSnapshot(gameRef, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const gameData = { ...snapshot.data() as Game, id: snapshot.id };
        setGame(gameData);
        
        const sortedPlayers = [...gameData.players].sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
        setPlayers(sortedPlayers);
        setCurrentPlayer(sortedPlayers.find(p => p.userId === userId) || null);

        setEvents([...(gameData.events || [])].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)));
        setMessages((gameData.chatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        setWolfMessages((gameData.wolfChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        setFairyMessages((gameData.fairyChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        setTwinMessages((gameData.twinChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        setLoversMessages((gameData.loversChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        setGhostMessages((gameData.ghostChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        
        setError(null);
      } else {
        setError('Partida no encontrada.');
        setGame(null);
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

    return () => unsubscribeGame();
  }, [gameId, firestore, userId]);

  return { 
    game, 
    players, 
    currentPlayer, 
    events, 
    messages, 
    wolfMessages, 
    fairyMessages, 
    twinMessages, 
    loversMessages, 
    ghostMessages, 
    loading, 
    error 
  };
};
