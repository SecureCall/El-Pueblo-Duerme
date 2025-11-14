
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useGameSession } from '@/hooks/use-game-session';
import { useGameState } from '@/hooks/use-game-state';
import { EnterNameModal } from './EnterNameModal';
import { joinGame } from '@/lib/firebase-actions';
import { Loader2, ArrowLeft } from 'lucide-react';
import { GameLobby } from './GameLobby';
import { GameBoard } from './GameBoard';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { GameMusic } from './GameMusic';
import Link from 'next/link';
import { Button } from '../ui/button';

export function GameRoom({ gameId }: { gameId: string }) {
  const { userId, displayName, setDisplayName, isSessionLoaded, avatarUrl } = useGameSession();
  const { game, players, currentPlayer, loading, error: gameStateError } = useGameState(gameId);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);


  const handleNameSubmit = useCallback(
    (name: string) => {
      setDisplayName(name);
      setJoinError(null);
    },
    [setDisplayName]
  );

  const handleJoinGame = useCallback(async () => {
    if (!displayName || !avatarUrl || !userId || !game) return;
    
    const isPlayerInGame = game.players.some(p => p.userId === userId);
    if (isPlayerInGame) return;

    setIsJoining(true);
    setJoinError(null);

    const result = await joinGame({ gameId, userId, displayName, avatarUrl });

    if (result.error) {
      setJoinError(result.error);
      if (result.error.includes('nombre ya está en uso')) {
        setDisplayName(null); // Force user to re-enter name
      }
    }
    setIsJoining(false);
  }, [gameId, userId, displayName, avatarUrl, game, setDisplayName]);

  useEffect(() => {
    if (isSessionLoaded && game && displayName && !currentPlayer && game.status === 'waiting' && !isJoining) {
      handleJoinGame();
    }
  }, [isSessionLoaded, game, displayName, currentPlayer, isJoining, handleJoinGame]);

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
        <div className="flex flex-col items-center gap-4 text-white">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="text-xl text-primary-foreground/80">Cargando partida...</p>
        </div>
      );
    }

    if (gameStateError) {
        return (
            <div className='text-center text-white space-y-4'>
                <p className="text-destructive text-2xl font-bold">{gameStateError}</p>
                 <Button asChild>
                    <Link href="/"><ArrowLeft className="mr-2" /> Volver al Inicio</Link>
                </Button>
            </div>
        );
    }
    
    if (!displayName) {
      return <EnterNameModal isOpen={!displayName} onNameSubmit={handleNameSubmit} error={joinError} />;
    }

    if (!game) {
        return (
            <div className='text-center text-white space-y-4'>
                <p className="text-destructive text-2xl font-bold">Esta partida no existe o ha sido eliminada.</p>
                 <Button asChild>
                    <Link href="/"><ArrowLeft className="mr-2" /> Volver al Inicio</Link>
                </Button>
            </div>
        );
    }
    
    if (!currentPlayer && game.status === 'waiting' && game.players.length >= game.maxPlayers) {
         return (
             <div className='text-center text-white space-y-4'>
                <p className="text-destructive text-2xl font-bold">Esta partida está llena.</p>
                 <Button asChild>
                    <Link href="/"><ArrowLeft className="mr-2" /> Volver al Inicio</Link>
                </Button>
            </div>
        );
    }

    if (!currentPlayer && game.status !== 'waiting') {
        return (
             <div className='text-center text-white space-y-4'>
                <p className="text-destructive text-2xl font-bold">Esta partida ya ha comenzado.</p>
                 <Button asChild>
                    <Link href="/"><ArrowLeft className="mr-2" /> Volver al Inicio</Link>
                </Button>
            </div>
        );
    }


    if (!currentPlayer) {
        return (
            <div className="flex flex-col items-center gap-4 text-white">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="text-xl text-primary-foreground/80">Uniéndote como {displayName}...</p>
            </div>
        );
    }
    
    switch (game.status) {
        case 'waiting':
            return <GameLobby game={game} players={players} isCreator={game.creator === userId} />;
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
