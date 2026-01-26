

'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Game, Player, GameEvent, ChatMessage, PlayerPublicData, PlayerPrivateData } from '../types';
import { useFirebase, useDoc } from '../firebase';
import { useGameSession } from './use-game-session';

// Combined state for the hook's return value
interface CombinedGameState {
    game: Game | null;
    players: PlayerPublicData[];
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
        const playersForState: PlayerPublicData[] = game.players;
        let finalCurrentPlayer: Player | null = null;
        
        const selfPublicData = playersForState.find(p => p.userId === userId);

        if (selfPublicData && privateData) {
            finalCurrentPlayer = { ...selfPublicData, ...privateData };
        } else if (selfPublicData) {
            // This might happen briefly before privateData loads
            // We can construct a partial player object
             finalCurrentPlayer = { ...selfPublicData } as Player;
        }

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
