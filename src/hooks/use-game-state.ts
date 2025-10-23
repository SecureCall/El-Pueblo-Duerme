'use client';

import { useEffect, useReducer } from 'react';
import { 
  doc, 
  onSnapshot, 
  type DocumentData, 
  type DocumentSnapshot, 
  type FirestoreError,
} from 'firebase/firestore';
import type { Game, Player, GameEvent, ChatMessage } from '@/types';
import { useFirebase, useMemoFirebase } from '@/firebase';
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

type GameAction =
  | { type: 'SET_GAME_DATA'; payload: { game: Game; userId: string; } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

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

function gameReducer(state: GameState, action: GameAction): GameState {
    switch (action.type) {
        case 'SET_GAME_DATA':
            const { game, userId } = action.payload;
            const sortedPlayers = [...game.players].sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
            return {
                ...state,
                game,
                players: sortedPlayers,
                currentPlayer: sortedPlayers.find(p => p.userId === userId) || null,
                events: [...(game.events || [])].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)),
                messages: (game.chatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
                wolfMessages: (game.wolfChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
                fairyMessages: (game.fairyChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
                twinMessages: (game.twinChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
                loversMessages: (game.loversChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
                ghostMessages: (game.ghostChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)),
                loading: false,
                error: null,
            };
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_ERROR':
             return { 
                ...state, 
                loading: false,
                error: action.payload,
                game: null, players: [], currentPlayer: null, events: [], messages: [], wolfMessages: [], fairyMessages: [], twinMessages: [], loversMessages: [], ghostMessages: []
            };
        default:
            return state;
    }
}


export const useGameState = (gameId: string) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { firestore } = useFirebase();
  const { userId } = useGameSession();

  const gameRef = useMemoFirebase(() => {
    if (!gameId || !firestore) return null;
    return doc(firestore, 'games', gameId);
  }, [gameId, firestore]);

  useEffect(() => {
    if (!gameRef) {
        if (!gameId) dispatch({ type: 'SET_ERROR', payload: "No game ID provided." });
        else if (!firestore) dispatch({ type: 'SET_ERROR', payload: "Cargando sesión de Firebase..." });
        else dispatch({ type: 'SET_LOADING', payload: true });
        return;
    };

    dispatch({ type: 'SET_LOADING', payload: true });

    const unsubscribeGame = onSnapshot(gameRef, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const gameData = { ...snapshot.data() as Game, id: snapshot.id };
        if (userId) {
          dispatch({ type: 'SET_GAME_DATA', payload: { game: gameData, userId } });
        }
      } else {
        dispatch({ type: 'SET_ERROR', payload: 'Partida no encontrada.' });
      }
    }, (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: gameRef.path,
        });
        dispatch({ type: 'SET_ERROR', payload: "Error al cargar la partida. Permisos insuficientes." });
        errorEmitter.emit('permission-error', contextualError);
    });

    return () => {
      unsubscribeGame();
    };
  }, [gameId, firestore, gameRef, userId]);

  return { ...state };
};
