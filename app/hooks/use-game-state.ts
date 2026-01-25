
'use client';

import { useEffect, useReducer, useRef } from 'react';
import { 
  doc, 
  onSnapshot, 
  type DocumentData, 
  type DocumentSnapshot, 
  type FirestoreError,
} from 'firebase/firestore';
import type { Game, Player, GameEvent, ChatMessage } from '../types';
import { useFirebase } from '../firebase';
import { errorEmitter } from '../firebase/error-emitter';
import { FirestorePermissionError } from '../firebase/errors';
import { useGameSession } from './use-game-session';
import { getMillis } from '../lib/utils';


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
        case 'SET_GAME_DATA': {
            const { game, userId } = action.payload;

            // Sanitize player data to prevent role leakage to client state
            const sanitizedPlayers = game.players.map(p => {
                // Show full data for myself or for dead players
                if (p.userId === userId || !p.isAlive) {
                    return p;
                }

                // For other living players, create a public version
                const sanitizedPlayer = { ...p };
                sanitizedPlayer.role = null;
                sanitizedPlayer.secretObjectiveId = null;
                sanitizedPlayer.executionerTargetId = null;
                delete sanitizedPlayer.potions;
                delete sanitizedPlayer.bansheeScreams;
                
                return sanitizedPlayer;
            });
            
            const sortedPlayers = [...sanitizedPlayers].sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
            // The current player object should have all its data, so we find it from the original unsanitized list
            const currentPlayer = game.players.find(p => p.userId === userId) || null;

            return {
                ...state,
                game: { ...game, players: sortedPlayers }, // Update game object with sanitized players for general use
                players: sortedPlayers,
                currentPlayer: currentPlayer, // The current user still gets their full data object.
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
                ...initialState,
                loading: false,
                error: action.payload,
            };
        default:
            return state;
    }
}


export const useGameState = (gameId: string) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { firestore } = useFirebase();
  const { userId, isSessionLoaded } = useGameSession();
  const gameRef = useRef(firestore ? doc(firestore, 'games', gameId) : null);
  

  // Firestore listener
  useEffect(() => {
    if (!firestore || !userId || !isSessionLoaded) return;
    if (!gameRef.current || gameRef.current.path !== `games/${gameId}`) {
        gameRef.current = doc(firestore, 'games', gameId);
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    const unsubscribeGame = onSnapshot(gameRef.current, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const gameData = { ...snapshot.data() as Game, id: snapshot.id };
        dispatch({ type: 'SET_GAME_DATA', payload: { game: gameData, userId } });
      } else {
        dispatch({ type: 'SET_ERROR', payload: 'Partida no encontrada.' });
      }
    }, (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: gameRef.current!.path,
        });
        dispatch({ type: 'SET_ERROR', payload: "Error al cargar la partida. Permisos insuficientes." });
        errorEmitter.emit('permission-error', contextualError);
    });

    return () => {
      unsubscribeGame();
    };
  }, [gameId, firestore, userId, isSessionLoaded]);


  return { ...state };
};
