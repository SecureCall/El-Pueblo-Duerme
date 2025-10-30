
'use client';

import { useEffect, useReducer, useRef } from 'react';
import { 
  doc, 
  onSnapshot, 
  type DocumentData, 
  type DocumentSnapshot, 
  type FirestoreError,
  Timestamp,
} from 'firebase/firestore';
import type { Game, Player, GameEvent, ChatMessage } from '@/types';
import { useFirebase } from '@/firebase';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useGameSession } from './use-game-session';
import { getMillis } from '@/lib/utils';

// This function is the single source of truth for converting Firestore data to plain objects.
// It's crucial for preventing the "Maximum call stack size exceeded" error.
const toPlainObject = (obj: any): any => {
    if (obj === undefined || obj === null) {
        return obj;
    }
    // Convert Timestamps to ISO strings for safe serialization
    if (obj instanceof Timestamp) {
        return obj.toDate().toISOString();
    }
    // Also handle regular Date objects, just in case
    if (obj instanceof Date) {
        return obj.toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(item => toPlainObject(item));
    }
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            // We only assign the property if it's not undefined to avoid serialization issues
            if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
                newObj[key] = toPlainObject(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
};


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
  const { userId } = useGameSession();
  
  const [state, dispatch] = useReducer(gameReducer, initialReducerState);
  const gameRef = useRef<DocumentData | null>(null);
  
  useEffect(() => {
    if (!firestore || !userId || !gameId) {
        dispatch({ 
            type: 'SET_ERROR', 
            payload: !gameId ? "No se ha proporcionado un ID de partida." : "Cargando sesión de Firebase..." 
        });
        return;
    };

    dispatch({ type: 'SET_LOADING', payload: true });

    if (!gameRef.current) {
      gameRef.current = doc(firestore, 'games', gameId);
    }
    
    const unsubscribeGame = onSnapshot(gameRef.current, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const rawData = { ...snapshot.data() as Game, id: snapshot.id };
        // CRITICAL: Sanitize data immediately upon receipt from Firestore.
        const gameData = toPlainObject(rawData);
        
        dispatch({ type: 'SET_GAME_DATA', payload: { game: gameData, userId } });
      } else {
        dispatch({ type: 'SET_ERROR', payload: 'Partida no encontrada.' });
      }
    }, (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: (gameRef.current as any)?.path || `games/${gameId}`,
        });
        dispatch({ type: 'SET_ERROR', payload: "Error al cargar la partida. Permisos insuficientes." });
        errorEmitter.emit('permission-error', contextualError);
    });

    return () => unsubscribeGame();
  }, [gameId, firestore, userId]);

  return state;
};

    