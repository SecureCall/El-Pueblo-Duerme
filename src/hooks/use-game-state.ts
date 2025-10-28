
"use client";

import { useEffect, useState, useRef } from 'react';
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
import { runAIActions, triggerAIVote } from "@/lib/ai-actions";
import { processNight } from '@/lib/game-logic';

export const useGameState = (gameId: string) => {
  const { firestore } = useFirebase();
  const { userId, isSessionLoaded } = useGameSession();

  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [wolfMessages, setWolfMessages] = useState<ChatMessage[]>([]);
  const [fairyMessages, setFairyMessages] = useState<ChatMessage[]>([]);
  const [twinMessages, setTwinMessages] = useState<ChatMessage[]>([]);
  const [loversMessages, setLoversMessages] = useState<ChatMessage[]>([]);
  const [ghostMessages, setGhostMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firestore || !userId || !isSessionLoaded || !gameId) {
        if(!gameId) {
            setError("No game ID provided.");
            setLoading(false);
        }
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

    return () => {
      unsubscribeGame();
    };
  }, [gameId, firestore, userId, isSessionLoaded]);


  const prevPhaseRef = useRef<Game['phase']>();
  const nightSoundsPlayedForRound = useRef<number>(0);

  // Game logic triggers (sounds, AI actions)
  useEffect(() => {
    if (!game || !currentPlayer || !firestore) return;
    
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
           if (game.creator === currentPlayer.userId) {
                runAIActions(firestore, game.id);
            }
          break;
        case 'day':
          playSoundEffect('/audio/effects/rooster-crowing-364473.mp3');
          setTimeout(() => {
            playNarration('dia_pueblo_despierta.mp3');
            setTimeout(() => {
              playNarration('inicio_debate.mp3');
              if (firestore && game.creator === currentPlayer.userId) {
                  triggerAIVote(firestore, game.id);
              }
            }, 2000);
          }, 1500);
          break;
      }
    }
    
    if (game.phase === 'role_reveal' && game.creator === currentPlayer?.userId && game.status === 'in_progress') {
        const timer = setTimeout(() => {
            if (firestore) {
                processNight(firestore, game.id); 
            }
        }, 15000);
        return () => clearTimeout(timer);
    }
    
    prevPhaseRef.current = game.status === 'finished' ? 'finished' : game.phase;

    const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
    if (nightEvent && nightSoundsPlayedForRound.current !== game.currentRound) {
        const hasDeaths = (nightEvent.data?.killedPlayerIds?.length || 0) > 0;
        
        setTimeout(() => {
            if (hasDeaths) {
                playNarration('descanse_en_paz.mp3');
            }
        }, 3000); 
        nightSoundsPlayedForRound.current = game.currentRound; 
    }

  }, [game, currentPlayer, events, firestore]);

  return { game, players, currentPlayer, events, messages, wolfMessages, fairyMessages, twinMessages, loversMessages, ghostMessages, loading, error };
};
