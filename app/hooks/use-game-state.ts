

'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Game, Player, GameEvent, ChatMessage, PlayerPublicData, PlayerPrivateData } from '../types';
import { useFirebase } from '../firebase/provider';
import { useDoc } from '../firebase/firestore/use-doc';
import { useGameSession } from './use-game-session';

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

export const useGameState = (gameId: string): CombinedGameState => {
  const { firestore } = useFirebase();
  const { userId, isSessionLoaded } = useGameSession();

  const gameRef = firestore && gameId ? doc(firestore, 'games', gameId) : null;
  const playerPrivateRef = firestore && gameId && userId ? doc(firestore, 'games', gameId, 'playerData', userId) : null;

  const { data: game, loading: gameLoading, error: gameError } = useDoc<Game>(gameRef);
  const { data: privateData, loading: privateDataLoading, error: privateDataError } = useDoc<PlayerPrivateData>(playerPrivateRef);
  
  const [combinedState, setCombinedState] = useState<CombinedGameState>({
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
  });

  useEffect(() => {
    const loading = !isSessionLoaded || gameLoading || (userId && privateDataLoading);
    const error = gameError?.message || privateDataError?.message || null;
    
    if (loading || error) {
        setCombinedState(prev => ({ ...prev, loading, error }));
        return;
    }

    if (game) {
        // Construct the full player list by combining public data with private data where available
        const playersForState: Player[] = game.players.map(publicData => {
            if (publicData.userId === userId && privateData) {
                // This is the current user, merge public and private data
                return { ...publicData, ...privateData };
            }
            // For other players, we only have public data, but we cast to Player for simplicity.
            // The missing private fields will be `undefined`.
            return { ...publicData } as Player;
        });

        const finalCurrentPlayer = playersForState.find(p => p.userId === userId) || null;

        setCombinedState({
            game,
            players: playersForState,
            currentPlayer: finalCurrentPlayer,
            events: game.events || [],
            messages: game.chatMessages || [],
            wolfMessages: game.wolfChatMessages || [],
            fairyMessages: game.fairyChatMessages || [],
            twinMessages: game.twinChatMessages || [],
            loversMessages: game.loversChatMessages || [],
            ghostMessages: game.ghostChatMessages || [],
            loading: false,
            error: null,
        });

    } else {
        // Handle case where game is null (not found or error)
        setCombinedState(prev => ({
            ...prev,
            game: null,
            players: [],
            currentPlayer: null,
            loading: false,
            error: prev.error || "Partida no encontrada."
        }));
    }

  }, [game, privateData, userId, isSessionLoaded, gameLoading, privateDataLoading, gameError, privateDataError]);

  return combinedState;
};
