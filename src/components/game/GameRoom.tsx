
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { useGameState } from '@/hooks/use-game-state';
import { EnterNameModal } from './EnterNameModal';
import { joinGame } from '@/lib/firebase-actions';
import { Loader2 } from 'lucide-react';
import { GameLobby } from './GameLobby';
import { GameBoard } from './GameBoard';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirebase } from '@/firebase';
import { GameMusic } from './GameMusic';

export function GameRoom({ gameId }: { gameId: string }) {
  const { userId, displayName, setDisplayName, isSessionLoaded, avatarUrl } = useGameSession();
  const { game, players, currentPlayer, loading, error: gameStateError } = useGameState(gameId);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const { firestore } = useFirebase();

  const handleNameSubmit = useCallback(
    (name: string) => {
      setDisplayName(name);
      setJoinError(null);
    },
    [setDisplayName]
  );

  const handleJoinGame = useCallback(async () => {
    if (!displayName || !firestore || !avatarUrl || !userId) return;

    setIsJoining(true);
    setJoinError(null);

    const result = await joinGame(firestore, gameId, userId, displayName, avatarUrl);

    if (result.error) {
      setJoinError(result.error);
      if (result.error.includes('nombre ya está en uso')) {
        setDisplayName(null); // Force user to re-enter name
      }
    }
    setIsJoining(false);
  }, [displayName, firestore, gameId, userId, setDisplayName, avatarUrl]);

  useEffect(() => {
    if (isSessionLoaded && game && displayName && !currentPlayer && game.status === 'waiting' && !isJoining) {
      handleJoinGame();
    }
  }, [game, displayName, currentPlayer, isJoining, handleJoinGame, isSessionLoaded]);

  const getMusicSrc = () => {
    if (!game) return '/audio/lobby-theme.mp3';
    switch (game.phase) {
      case 'day':
        return '/audio/day-theme.mp3';
      case 'night':
      case 'role_reveal':
      case 'hunter_shot':
        return '/audio/night-theme.mp3';
      case 'waiting':
      case 'finished':
      default:
        return '/audio/lobby-theme.mp3';
    }
  };

  const bgImageId = game?.phase === 'day' ? 'game-bg-day' : 'game-bg-night';
  const bgImage = PlaceHolderImages.find((img) => img.id === bgImageId);

  const renderContent = () => {
    if (loading || !isSessionLoaded || !avatarUrl || (gameId && !game && !gameStateError)) {
      return (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="text-xl text-primary-foreground/80">Cargando partida...</p>
        </div>
      );
    }

    if (gameStateError) {
      return <p className="text-destructive text-xl">{gameStateError}</p>;
    }
    
    if (!displayName) {
      return <EnterNameModal isOpen={!displayName} onNameSubmit={handleNameSubmit} error={joinError} />;
    }

    if (!game || !currentPlayer) {
        if (game && game.status !== 'waiting') {
            return <p className="text-destructive text-xl">Esta partida ya ha comenzado o está llena.</p>;
        }
         if (game && players.length >= game.maxPlayers) {
            return <p className="text-destructive text-xl">Esta partida está llena.</p>;
        }
        return (
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="text-xl text-primary-foreground/80">Uniéndote como {displayName}...</p>
            </div>
        );
    }
    
    switch (game.status) {
        case 'waiting':
            return <GameLobby game={game} players={players} isCreator={game.creator === userId} currentPlayer={currentPlayer} />;
        case 'in_progress':
        case 'finished':
            return <GameBoard gameId={gameId} />;
        default:
            return <p>Estado de la partida desconocido.</p>;
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden">
      {bgImage && (
        <Image
          src={bgImage.imageUrl}
          alt={bgImage.description}
          fill
          className="object-cover z-0 transition-opacity duration-1000"
          data-ai-hint={bgImage.imageHint}
          key={bgImage.id}
          priority
        />
      )}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <GameMusic src={getMusicSrc()} />
      <div className="relative z-10 w-full flex items-center justify-center">{renderContent()}</div>
    </div>
  );
}
