
'use client';

import { useEffect, useReducer, useMemo } from 'react';
import { doc } from 'firebase/firestore';
import type { Game, Player, GameEvent, ChatMessage, PlayerPublicData, PlayerPrivateData } from '../types';
import { useFirebase } from '../firebase/provider';
import { useDoc } from '../firebase/firestore/use-doc';
import { useGameSession } from './use-game-session';
import { getMillis } from '../lib/utils';
import { getDoc, getDocs, collection } from 'firebase/firestore';

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
  const { data: game, loading: gameLoading, error: gameError } = useDoc<Game>(gameRef);
  
  useEffect(() => {
    const loading = !isSessionLoaded || gameLoading;
    const error = gameError?.message || null;
    
    if (loading || error) {
        dispatch({ type: 'SET_LOADING', payload: loading });
        if(error) dispatch({ type: 'SET_ERROR', payload: error });
        return;
    }

    if (game && firestore) {
        const fetchPrivateData = async () => {
            const gameDocRef = doc(firestore, 'games', gameId);
            const privateDataCollectionRef = collection(gameDocRef, 'playerData');
            
            const privateDataSnapshot = await getDocs(privateDataCollectionRef);

            const privateDataMap = new Map<string, PlayerPrivateData>();
            privateDataSnapshot.forEach(snap => {
                privateDataMap.set(snap.id, snap.data() as PlayerPrivateData);
            });

            const fullPlayers: Player[] = game.players.map(publicData => {
                const privateInfo = privateDataMap.get(publicData.userId);
                return { ...publicData, ...privateInfo } as Player;
            }).sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
            
            const currentPlayer = fullPlayers.find(p => p.userId === userId) || null;

            dispatch({ type: 'SET_GAME_DATA', payload: { game, players: fullPlayers, currentPlayer } });
        };
        
        fetchPrivateData().catch(e => dispatch({ type: 'SET_ERROR', payload: `Error fetching private player data: ${e.message}`}));

    } else if(!gameLoading) {
        dispatch({ type: 'SET_ERROR', payload: "Partida no encontrada." });
    }

  }, [game, gameId, firestore, userId, isSessionLoaded, gameLoading, gameError]);

  return state;
};
