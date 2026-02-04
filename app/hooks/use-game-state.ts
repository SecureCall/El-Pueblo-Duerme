
'use client';

import { useEffect, useReducer, useMemo } from 'react';
import { doc, onSnapshot, getDoc, FirestoreError, collection } from 'firebase/firestore';
import type { Game, Player, GameEvent, PlayerPrivateData, PlayerPublicData } from '../types';
import { useFirebase } from '../firebase/provider';
import { useGameSession } from './use-game-session';
import { getMillis } from '../lib/utils';
import { errorEmitter } from '../firebase/error-emitter';
import { FirestorePermissionError } from '../firebase/errors';
import { useCollection } from '../firebase/firestore/use-collection';

// Combined state for the hook's return value
interface CombinedGameState {
    game: Game | null;
    players: Player[];
    currentPlayer: Player | null;
    events: GameEvent[];
    loading: boolean;
    error: string | null;
}

type GameAction =
  | { type: 'SET_GAME_DATA'; payload: { game: Game } }
  | { type: 'SET_PLAYERS_DATA'; payload: { players: Player[]; currentPlayer: Player | null } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET_STATE' };


const initialState: CombinedGameState = {
    game: null,
    players: [],
    currentPlayer: null,
    events: [],
    loading: true,
    error: null,
};

function gameReducer(state: CombinedGameState, action: GameAction): CombinedGameState {
    switch (action.type) {
        case 'RESET_STATE':
            return initialState;
        case 'SET_GAME_DATA': {
            const { game } = action.payload;
            return {
                ...state,
                game,
                events: [...(game.events || [])].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)),
            };
        }
        case 'SET_PLAYERS_DATA': {
            const { players, currentPlayer } = action.payload;
            return {
                ...state,
                players,
                currentPlayer,
                events: state.events || [],
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


export const useGameState = (gameId: string): CombinedGameState => {
  const { firestore } = useFirebase();
  const { userId, isSessionLoaded } = useGameSession();

  const [state, dispatch] = useReducer(gameReducer, initialState);

  const gameRef = useMemo(() => firestore && gameId ? doc(firestore, 'games', gameId) : null, [firestore, gameId]);
  const playersRef = useMemo(() => firestore && gameId ? collection(firestore, `games/${gameId}/players`) : null, [firestore, gameId]);
  
  useEffect(() => {
    dispatch({ type: 'RESET_STATE' });
  }, [gameId]);
  
  useEffect(() => {
    if (!gameRef || !isSessionLoaded) {
      dispatch({ type: 'SET_LOADING', payload: true });
      return;
    }
    
    const unsubscribeGame = onSnapshot(gameRef, (gameSnap) => {
      if (!gameSnap.exists()) {
        dispatch({ type: 'SET_ERROR', payload: "Partida no encontrada." });
        return;
      }
      const gameData = gameSnap.data() as Game;
      dispatch({ type: 'SET_GAME_DATA', payload: { game: gameData } });
    }, (error) => {
        const contextualError = new FirestorePermissionError({ operation: 'get', path: gameRef.path });
        dispatch({ type: 'SET_ERROR', payload: `Error al cargar la partida: ${error.message}` });
        errorEmitter.emit('permission-error', contextualError);
    });

    return () => unsubscribeGame();
  }, [gameRef, isSessionLoaded]);

  const { data: publicPlayers, error: playersError } = useCollection<PlayerPublicData>(playersRef);
  
  useEffect(() => {
    if (playersError) {
        dispatch({ type: 'SET_ERROR', payload: `Error al cargar jugadores: ${playersError.message}` });
        return;
    }

    if (!userId || !isSessionLoaded || !publicPlayers) return;
    
    const privateDataRef = doc(firestore, `games/${gameId}/playerData`, userId);
    const privateDataUnsubscribe = onSnapshot(privateDataRef, privateSnap => {
        const privateData = privateSnap.exists() ? privateSnap.data() as PlayerPrivateData : null;
        
        const fullPlayers: Player[] = publicPlayers.map(publicData => {
          if (publicData.userId === userId && privateData) {
            return { ...publicData, ...privateData };
          }
          return publicData as Player;
        }).sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
        
        const currentPlayer = fullPlayers.find(p => p.userId === userId) || null;
        
        dispatch({ type: 'SET_PLAYERS_DATA', payload: { players: fullPlayers, currentPlayer } });

    }, e => {
        const err = e as FirestoreError;
        if (err.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({ path: `games/${gameId}/playerData/${userId}`, operation: 'get' });
            errorEmitter.emit('permission-error', permissionError);
            dispatch({ type: 'SET_ERROR', payload: `Error de permisos al cargar tus datos.` });
        } else {
            console.error("Error fetching private player data:", err);
            dispatch({ type: 'SET_ERROR', payload: `Error al cargar datos del jugador: ${err.message}` });
        }
    });

    return () => privateDataUnsubscribe();
  }, [publicPlayers, playersError, userId, isSessionLoaded, gameId, firestore]);

  return state;
};

    