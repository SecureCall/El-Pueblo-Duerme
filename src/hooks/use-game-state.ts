
'use client';

import { useEffect, useReducer, useRef } from 'react';
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
import { playNarration, playSoundEffect } from '@/lib/sounds';


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
  const prevPhaseRef = useRef<Game['phase']>();
  const nightSoundsPlayedForRound = useRef<number>(0);

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


  useEffect(() => {
    if (!state.game || !state.currentPlayer) return;
    const prevPhase = prevPhaseRef.current;

    if (prevPhase !== state.game.phase) {
      switch (state.game.phase) {
        case 'night':
          if (state.game.currentRound === 1 && prevPhase === 'role_reveal') {
             playNarration('intro_epica.mp3');
             setTimeout(() => playNarration('noche_pueblo_duerme.mp3'), 4000);
          } else {
            playNarration('noche_pueblo_duerme.mp3');
          }
          break;
        case 'day':
          playSoundEffect('/audio/effects/rooster-crowing-364473.mp3');
          setTimeout(() => {
            playNarration('dia_pueblo_despierta.mp3');
            setTimeout(() => {
              playNarration('inicio_debate.mp3');
            }, 2000);
          }, 1500);
          break;
      }
    }
    
    prevPhaseRef.current = state.game.phase;

    const nightEvent = state.events.find(e => e.type === 'night_result' && e.round === state.game?.currentRound);
    if (nightEvent && nightSoundsPlayedForRound.current !== state.game.currentRound) {
        const hasDeaths = (nightEvent.data?.killedPlayerIds?.length || 0) > 0;
        
        setTimeout(() => {
            if (hasDeaths) {
                playNarration('Descanse en paz.mp3');
            }
        }, 3000); 
        nightSoundsPlayedForRound.current = state.game.currentRound; 
    }

  }, [state.game?.phase, state.game?.currentRound, state.events, state.players, state.currentPlayer, firestore, state.game]);


  return { ...state };
};
