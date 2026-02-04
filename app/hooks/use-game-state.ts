
'use client';

import { useEffect, useReducer, useMemo } from 'react';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import type { Game, Player, GameEvent, PlayerPrivateData, PlayerPublicData } from '../types';
import { useFirebase } from '../firebase/provider';
import { useGameSession } from './use-game-session';
import { getMillis } from '../lib/utils';
import { errorEmitter } from '../firebase/error-emitter';
import { FirestorePermissionError } from '../firebase/errors';
import { useCollection } from '../firebase/firestore/use-collection';

// State for the reducer
interface ReducerState {
    game: Game | null;
    publicPlayers: PlayerPublicData[];
    privateData: PlayerPrivateData | null;
    loading: boolean;
    error: string | null;
}

// Action types for the reducer
type GameAction =
  | { type: 'SET_GAME'; payload: Game | null }
  | { type: 'SET_PUBLIC_PLAYERS'; payload: PlayerPublicData[] }
  | { type: 'SET_PRIVATE_DATA'; payload: PlayerPrivateData | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };

// Combined state for the hook's return value
interface CombinedGameState {
    game: Game | null;
    players: Player[];
    currentPlayer: Player | null;
    events: GameEvent[];
    loading: boolean;
    error: string | null;
}

const initialState: ReducerState = {
    game: null,
    publicPlayers: [],
    privateData: null,
    loading: true,
    error: null,
};

function gameReducer(state: ReducerState, action: GameAction): ReducerState {
    switch (action.type) {
        case 'RESET_STATE':
            return initialState;
        case 'SET_GAME':
            return { ...state, game: action.payload, loading: !action.payload };
        case 'SET_PUBLIC_PLAYERS':
             return { ...state, publicPlayers: action.payload };
        case 'SET_PRIVATE_DATA':
            return { ...state, privateData: action.payload };
        case 'SET_ERROR':
             return { ...initialState, loading: false, error: action.payload };
        default:
            return state;
    }
}


export const useGameState = (gameId: string): CombinedGameState => {
  const { firestore } = useFirebase();
  const { userId, isSessionLoaded } = useGameSession();

  const [state, dispatch] = useReducer(gameReducer, initialState);

  // Memoize Firestore references
  const gameRef = useMemo(() => firestore && gameId ? doc(firestore, 'games', gameId) : null, [firestore, gameId]);
  const playersRef = useMemo(() => firestore && gameId ? collection(firestore, `games/${gameId}/players`) : null, [firestore, gameId]);
  const privateDataRef = useMemo(() => firestore && gameId && userId ? doc(firestore, `games/${gameId}/playerData`, userId) : null, [firestore, gameId, userId]);
  
  // Effect 1: Reset state if gameId changes
  useEffect(() => {
    dispatch({ type: 'RESET_STATE' });
  }, [gameId]);
  
  // Effect 2: Subscribe to the main game document
  useEffect(() => {
    if (!gameRef || !isSessionLoaded) return;
    
    const unsubscribeGame = onSnapshot(gameRef, (gameSnap) => {
      if (!gameSnap.exists()) {
        dispatch({ type: 'SET_ERROR', payload: "Partida no encontrada." });
        return;
      }
      dispatch({ type: 'SET_GAME', payload: gameSnap.data() as Game });
    }, (error) => {
        const contextualError = new FirestorePermissionError({ operation: 'get', path: gameRef.path });
        dispatch({ type: 'SET_ERROR', payload: `Error al cargar la partida: ${error.message}` });
        errorEmitter.emit('permission-error', contextualError);
    });

    return () => unsubscribeGame();
  }, [gameRef, isSessionLoaded]);

  // Effect 3: Subscribe to the public players collection
  const { data: publicPlayers, error: playersError } = useCollection<PlayerPublicData>(playersRef);
  useEffect(() => {
    if (playersError) {
        dispatch({ type: 'SET_ERROR', payload: `Error al cargar jugadores: ${playersError.message}` });
    } else if (publicPlayers) {
        dispatch({ type: 'SET_PUBLIC_PLAYERS', payload: publicPlayers });
    }
  }, [publicPlayers, playersError]);

  // Effect 4: Subscribe to the current user's private data
  useEffect(() => {
    if (!privateDataRef || !isSessionLoaded) return;

    const unsubscribePrivate = onSnapshot(privateDataRef, privateSnap => {
        dispatch({ type: 'SET_PRIVATE_DATA', payload: privateSnap.exists() ? privateSnap.data() as PlayerPrivateData : null });
    }, e => {
        const err = e as FirestoreError;
        const permissionError = new FirestorePermissionError({ path: privateDataRef.path, operation: 'get' });
        errorEmitter.emit('permission-error', permissionError);
        console.warn(`Permission denied fetching private data for ${userId}. This is expected for spectators.`);
    });
    return () => unsubscribePrivate();
  }, [privateDataRef, isSessionLoaded, userId]);

  // Derive the final combined state from the reducer state
  return useMemo((): CombinedGameState => {
      const { game, publicPlayers, privateData, error, loading } = state;

      if (error) {
          return { game: null, players: [], currentPlayer: null, events: [], loading: false, error };
      }

      if (!game) {
          return { game: null, players: [], currentPlayer: null, events: [], loading: true, error: null };
      }
      
      const fullPlayers: Player[] = (publicPlayers || []).map(publicData => {
          if (publicData.userId === userId && privateData) {
              return { ...publicData, ...privateData };
          }
          return publicData as Player;
      }).sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
      
      const currentPlayer = fullPlayers.find(p => p.userId === userId) as Player | null;
      
      return {
          game,
          players: fullPlayers,
          currentPlayer,
          events: [...(game.events || [])].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)),
          loading,
          error: null
      }
  }, [state, userId]);
};
