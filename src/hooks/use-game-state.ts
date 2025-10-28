'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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

export const useGameState = (gameId: string) => {
  const { firestore } = useFirebase();
  const { userId } = useGameSession();
  
  const [game, setGame] = useState<Game | null>(initialState.game);
  const [players, setPlayers] = useState<Player[]>(initialState.players);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(initialState.currentPlayer);
  const [events, setEvents] = useState<GameEvent[]>(initialState.events);
  const [messages, setMessages] = useState<ChatMessage[]>(initialState.messages);
  const [wolfMessages, setWolfMessages] = useState<ChatMessage[]>(initialState.wolfMessages);
  const [fairyMessages, setFairyMessages] = useState<ChatMessage[]>(initialState.fairyMessages);
  const [twinMessages, setTwinMessages] = useState<ChatMessage[]>(initialState.twinMessages);
  const [loversMessages, setLoversMessages] = useState<ChatMessage[]>(initialState.loversMessages);
  const [ghostMessages, setGhostMessages] = useState<ChatMessage[]>(initialState.ghostMessages);
  const [loading, setLoading] = useState<boolean>(initialState.loading);
  const [error, setError] = useState<string | null>(initialState.error);

  const prevPhaseRef = useRef<Game['phase']>();
  const nightSoundsPlayedForRound = useRef<number>(0);

  // Effect 1: Subscribe to Firestore for state updates
  useEffect(() => {
    if (!firestore || !userId || !gameId) {
        setLoading(false);
        if(!gameId) setError("No se ha proporcionado un ID de partida.");
        return;
    };

    setLoading(true);
    const gameRef = doc(firestore, 'games', gameId);

    const unsubscribeGame = onSnapshot(gameRef, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        const gameData = { ...snapshot.data() as Game, id: snapshot.id };
        setGame(gameData);
        
        const sortedPlayers = [...gameData.players].sort((a, b) => getMillis(a.joinedAt) - getMillis(b.joinedAt));
        setPlayers(sortedPlayers);
        setCurrentPlayer(sortedPlayers.find(p => p.userId === userId) || null);

        setEvents([...(gameData.events || [])].sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)));
        setMessages((gameData.chatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        setWolfMessages((gameData.wolfChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        setFairyMessages((gameData.fairyChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        setTwinMessages((gameData.twinChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        setLoversMessages((gameData.loversChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        setGhostMessages((gameData.ghostChatMessages || []).sort((a, b) => getMillis(a.createdAt) - getMillis(b.createdAt)));
        
        setError(null);
      } else {
        setError('Partida no encontrada.');
        setGame(null);
      }
      setLoading(false);
    }, (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
            operation: 'get',
            path: gameRef.path,
        });
        setError("Error al cargar la partida. Permisos insuficientes.");
        setLoading(false);
        errorEmitter.emit('permission-error', contextualError);
    });

    return () => unsubscribeGame();
  }, [gameId, firestore, userId]);

  // Effect 2: Game logic triggers (sounds, AI actions)
  useEffect(() => {
    if (!game || !currentPlayer || !firestore || game.status === 'finished') return;

    const isCreator = game.creator === currentPlayer.userId;
    const prevPhase = prevPhaseRef.current;
    
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
    
    const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
    if (nightEvent && nightSoundsPlayedForRound.current !== game.currentRound) {
        const hasDeaths = (nightEvent.data?.killedPlayerIds?.length || 0) > 0;
        setTimeout(() => {
            if (hasDeaths) playNarration('descanse_en_paz.mp3');
        }, 3000);
        nightSoundsPlayedForRound.current = game.currentRound;
    }
    
    prevPhaseRef.current = game.phase;

  }, [game?.phase, game?.currentRound, firestore, game?.id, game?.creator, game?.status, game?.players, game?.pendingHunterShot, currentPlayer, events]);


  return { 
    game, 
    players, 
    currentPlayer, 
    events, 
    messages, 
    wolfMessages, 
    fairyMessages, 
    twinMessages, 
    loversMessages, 
    ghostMessages, 
    loading, 
    error 
  };
};
