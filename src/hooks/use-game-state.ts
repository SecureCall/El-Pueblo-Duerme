
"use client";

import { useEffect, useReducer } from 'react';
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

type GameAction =
  | { type: 'SET_GAME_DATA'; payload: { game: Game; userId: string; } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialReducerState: GameState = {
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
        case 'SET_GAME_DATA': {
            const { game, userId } = action.payload;
            
            const sortedPlayers = [...game.players].sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
            const currentPlayer = sortedPlayers.find(p => p.userId === userId) || null;
            const sortedEvents = [...(game.events || [])].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
            const sortedMessages = (game.chatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
            const sortedWolfMessages = (game.wolfChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
            const sortedFairyMessages = (game.fairyChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
            const sortedTwinMessages = (game.twinChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
            const sortedLoversMessages = (game.loversChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
            const sortedGhostMessages = (game.ghostChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt));
            
            return {
                ...state,
                game,
                players: sortedPlayers,
                currentPlayer,
                events: sortedEvents,
                messages: sortedMessages,
                wolfMessages: sortedWolfMessages,
                fairyMessages: sortedFairyMessages,
                twinMessages: sortedTwinMessages,
                loversMessages: sortedLoversMessages,
                ghostMessages: sortedGhostMessages,
                loading: false,
                error: null,
            };
        }
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_ERROR':
             return { 
                ...initialReducerState,
                loading: false,
                error: action.payload,
            };
        default:
            return state;
    }
}


export const useGameState = (gameId: string) => {
  const { firestore } = useFirebase();
  const { userId, isSessionLoaded } = useGameSession();
  
  const [state, dispatch] = useReducer(gameReducer, initialReducerState);
  
  useEffect(() => {
    if (!firestore || !gameId) {
        if (!state.game) {
            dispatch({ type: 'SET_LOADING', payload: true });
        }
        return;
    };

    const gameRef = doc(firestore, 'games', gameId);
    
    const unsubscribeGame = onSnapshot(gameRef, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const gameData = { ...snapshot.data(), id: snapshot.id } as Game;
        // userId and isSessionLoaded might change, so we read the latest value inside the listener
        const currentUserId = auth.currentUser?.uid;
        if(currentUserId) {
            dispatch({ type: 'SET_GAME_DATA', payload: { game: gameData, userId: currentUserId } });
        }
      } else {
        dispatch({ type: 'SET_ERROR', payload: 'Partida no encontrada.' });
      }
    }, (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: gameRef.path || `games/${gameId}`,
        });
        dispatch({ type: 'SET_ERROR', payload: "Error al cargar la partida. Permisos insuficientes." });
        errorEmitter.emit('permission-error', contextualError);
    });

    const auth = useAuth();
    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
        if (user && state.game) {
            // If the user changes, re-dispatch the game data with the new user ID
            dispatch({ type: 'SET_GAME_DATA', payload: { game: state.game, userId: user.uid } });
        }
    });

    return () => {
        unsubscribeGame();
        authUnsubscribe();
    }
  }, [gameId, firestore]);

  return state;
};
