
'use client';

import { useEffect, useReducer, useMemo } from 'react';
import { doc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import type { Game, Player, GameEvent, ChatMessage, PlayerPublicData, PlayerPrivateData } from '../types';
import { useFirebase } from '../firebase/provider';
import { useDoc } from '../firebase/firestore/use-doc';
import { useGameSession } from './use-game-session';
import { getMillis } from '../lib/utils';
import { errorEmitter } from '../firebase/error-emitter';
import { FirestorePermissionError } from '../firebase/errors';


// Combined state for the hook's return value
interface CombinedGameState {
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
  | { type: 'SET_GAME_DATA'; payload: { game: Game; userId: string; players: Player[]; currentPlayer: Player | null } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };


const initialState: CombinedGameState = {
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

function gameReducer(state: CombinedGameState, action: GameAction): CombinedGameState {
    switch (action.type) {
        case 'SET_GAME_DATA': {
            const { game, players, currentPlayer } = action.payload;
            return {
                ...state,
                game,
                players,
                currentPlayer,
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


export const useGameState = (gameId: string): CombinedGameState => {
  const { firestore } = useFirebase();
  const { userId, isSessionLoaded } = useGameSession();

  const [state, dispatch] = useReducer(gameReducer, initialState);

  const gameRef = useMemo(() => firestore && gameId ? doc(firestore, 'games', gameId) : null, [firestore, gameId]);
  
  useEffect(() => {
    if (!gameRef || !userId || !isSessionLoaded) {
      dispatch({ type: 'SET_LOADING', payload: true });
      return;
    }

    const unsubscribe = onSnapshot(gameRef, async (gameSnap) => {
      if (!gameSnap.exists()) {
        dispatch({ type: 'SET_ERROR', payload: "Partida no encontrada." });
        return;
      }
      
      const gameData = gameSnap.data() as Game;

      try {
        const privateDataRef = doc(firestore, `games/${gameId}/playerData`, userId);
        const privateSnap = await getDoc(privateDataRef);

        const fullPlayers: Player[] = gameData.players.map(publicData => {
          let privateData: PlayerPrivateData | {} = {};
          if (publicData.userId === userId && privateSnap.exists()) {
            privateData = privateSnap.data() as PlayerPrivateData;
          }
          return { ...publicData, ...privateData };
        }).sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
        
        const currentPlayer = fullPlayers.find(p => p.userId === userId) || null;
        
        dispatch({ type: 'SET_GAME_DATA', payload: { game: gameData, players: fullPlayers, currentPlayer } });

      } catch (e) {
          const err = e as FirestoreError;
          if (err.code === 'permission-denied') {
              const permissionError = new FirestorePermissionError({
                  path: `games/${gameId}/playerData/${userId}`,
                  operation: 'get',
              });
              errorEmitter.emit('permission-error', permissionError);
              dispatch({ type: 'SET_ERROR', payload: `Error de permisos al cargar tus datos.` });
          } else {
              dispatch({ type: 'SET_ERROR', payload: `Error al cargar datos del jugador: ${err.message}` });
          }
      }
    }, (error) => {
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: gameRef.path,
        });
        dispatch({ type: 'SET_ERROR', payload: `Error al cargar la partida: ${error.message}` });
        errorEmitter.emit('permission-error', contextualError);
    });

    return () => unsubscribe();

  }, [gameRef, gameId, firestore, userId, isSessionLoaded]);

  return state;
};

