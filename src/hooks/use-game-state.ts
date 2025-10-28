
"use client";

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
import { getMillis, toPlainObject } from '@/lib/utils';

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
  const [state, setState] = useState<GameState>(initialState);
  const { firestore } = useFirebase();
  const { userId } = useGameSession();
  
  useEffect(() => {
    if (!firestore || !userId || !gameId) {
        setState(prev => ({ 
            ...prev, 
            loading: false, 
            error: !gameId ? "No se ha proporcionado un ID de partida." : prev.error 
        }));
        return;
    };

    setState(prev => ({ ...prev, loading: true }));
    const gameRef = doc(firestore, 'games', gameId);

    const unsubscribeGame = onSnapshot(gameRef, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const gameData = toPlainObject({ ...snapshot.data() as Game, id: snapshot.id });
        
        const sortedPlayers = [...gameData.players].sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
        
        setState({
          game: gameData,
          players: sortedPlayers,
          currentPlayer: sortedPlayers.find(p => p.userId === userId) || null,
          events: [...(gameData.events || [])].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)),
          messages: (gameData.chatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
          wolfMessages: (gameData.wolfChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
          fairyMessages: (gameData.fairyChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
          twinMessages: (gameData.twinChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
          loversMessages: (gameData.loversChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
          ghostMessages: (gameData.ghostChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
          loading: false,
          error: null,
        });
      } else {
        setState({ ...initialState, loading: false, error: 'Partida no encontrada.' });
      }
    }, (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: gameRef.path,
        });
        setState({ ...initialState, loading: false, error: "Error al cargar la partida. Permisos insuficientes." });
        errorEmitter.emit('permission-error', contextualError);
    });

    return () => unsubscribeGame();
  }, [gameId, firestore, userId]);

  return state;
};

    