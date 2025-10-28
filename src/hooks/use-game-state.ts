'use client';

import { useEffect, useReducer, useRef, useCallback } from 'react';
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
import { runAIActions, triggerAIVote, runAIHunterShot } from "@/lib/ai-actions";
import { processNight, processVotes, processJuryVotes } from '@/lib/game-logic';


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
  const { game, currentPlayer, events } = state;


  // Effect 1: Subscribe to Firestore for state updates
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


  // Effect 2: Handle side effects based on stable state changes (sounds, AI, phase transitions)
  useEffect(() => {
    if (!game || !currentPlayer || !firestore || game.status === 'finished') return;

    const isCreator = game.creator === currentPlayer.userId;
    const prevPhase = prevPhaseRef.current;

    // --- Sound and AI action triggers on phase change ---
    if (prevPhase !== game.phase) {
        switch (game.phase) {
            case 'night':
                if (game.currentRound === 1 && prevPhase === 'role_reveal') {
                    playNarration('intro_epica.mp3');
                    setTimeout(() => playNarration('noche_pueblo_duerme.mp3'), 4000);
                } else {
                    playNarration('noche_pueblo_duerme.mp3');
                }
                if (isCreator) runAIActions(firestore, game.id);
                break;
            case 'day':
                playSoundEffect('/audio/effects/rooster-crowing-364473.mp3');
                setTimeout(() => {
                    playNarration('dia_pueblo_despierta.mp3');
                    setTimeout(() => {
                        playNarration('inicio_debate.mp3');
                        if (isCreator) triggerAIVote(firestore, game.id);
                    }, 2000);
                }, 1500);
                break;
            case 'hunter_shot':
                 if (isCreator) {
                    const pendingHunter = game.players.find(p => p.userId === game.pendingHunterShot);
                    if (pendingHunter?.isAI) runAIHunterShot(firestore, game.id, pendingHunter);
                 }
                break;
        }
    }

    // --- Night result sound trigger ---
    const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
    if (nightEvent && nightSoundsPlayedForRound.current !== game.currentRound) {
        const hasDeaths = (nightEvent.data?.killedPlayerIds?.length || 0) > 0;
        setTimeout(() => {
            if (hasDeaths) playNarration('descanse_en_paz.mp3');
        }, 3000);
        nightSoundsPlayedForRound.current = game.currentRound;
    }

    // --- Automatic Phase Transition Logic (Creator only) ---
    const handlePhaseEnd = async () => {
        if (!isCreator) return;
        if (game.phase === 'day') await processVotes(firestore, game.id);
        else if (game.phase === 'night') await processNight(firestore, game.id);
        else if (game.phase === 'jury_voting') await processJuryVotes(firestore, game.id);
    };

    const phaseEndsAt = game.phaseEndsAt ? getMillis(game.phaseEndsAt) : 0;
    const now = Date.now();
    
    if (phaseEndsAt > now) {
        const remaining = phaseEndsAt - now;
        const timer = setTimeout(handlePhaseEnd, remaining);
        return () => clearTimeout(timer);
    }
    
    // Update ref for next render
    prevPhaseRef.current = game.phase;

  }, [game?.phase, game?.currentRound, game?.id, currentPlayer?.userId, game?.creator, firestore, events]);


  return { ...state };
};
