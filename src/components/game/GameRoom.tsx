
"use client";

import { useEffect, useState } from "react";
import { useGameSession } from "@/hooks/use-game-session";
import { useGameState } from "@/hooks/use-game-state";
import { EnterNameModal } from "./EnterNameModal";
import { joinGame } from "@/lib/firebase-actions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { GameLobby } from "./GameLobby";
import { useToast } from "@/hooks/use-toast";
import { GameBoard } from "./GameBoard";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { useFirebase } from "@/firebase";
import { GameMusic } from "./GameMusic";

export function GameRoom({ gameId }: { gameId: string }) {
  const { userId, displayName, setDisplayName, isSessionLoaded } = useGameSession();
  const { game, players, events, messages, loading, error } = useGameState(gameId);
  const [isJoining, setIsJoining] = useState(false);
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const handleJoinGame = async () => {
    if (!displayName || !firestore) return;
    setIsJoining(true);
    const result = await joinGame(firestore, gameId, userId, displayName);
    if (result.error) {
      toast({
        variant: "destructive",
        title: "Error al unirse",
        description: result.error,
      });
    }
    setIsJoining(false);
  };
  
  const getMusicSrc = () => {
    if (!game) return "/audio/lobby-theme.mp3";
    switch (game.phase) {
      case 'day':
        return "/audio/day-theme.mp3";
      case 'night':
      case 'role_reveal':
      case 'hunter_shot':
        return "/audio/night-theme.mp3";
      case 'waiting':
      case 'finished':
      default:
        return "/audio/lobby-theme.mp3";
    }
  };

  const bgImageId = game?.phase === 'day' ? 'game-bg-day' : 'game-bg-night';
  const bgImage = PlaceHolderImages.find((img) => img.id === bgImageId);

  const renderContent = () => {
    if (loading || !isSessionLoaded) {
      return (
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <p className="text-xl text-primary-foreground/80">Cargando partida...</p>
        </div>
      );
    }

    if (error || !game) {
      return <p className="text-destructive text-xl">{error || "Partida no encontrada."}</p>;
    }
    
    if (!displayName) {
        return <EnterNameModal isOpen={!displayName} onNameSubmit={setDisplayName} />;
    }

    const currentPlayer = players.find((p) => p.userId === userId);

    if (!currentPlayer) {
      if (game.status !== 'waiting') {
        return <p className="text-destructive text-xl">Esta partida ya ha comenzado.</p>;
      }
       if (players.length >= game.maxPlayers) {
        return <p className="text-destructive text-xl">Esta partida está llena.</p>;
      }
      return (
        <Button onClick={handleJoinGame} disabled={isJoining} size="lg">
          {isJoining ? <Loader2 className="animate-spin" /> : `Unirse como ${displayName}`}
        </Button>
      );
    }
    
    switch (game.status) {
        case 'waiting':
            return <GameLobby game={game} players={players} isCreator={game.creator === userId} />;
        case 'in_progress':
        case 'finished':
            // Pass sorted events to game board
            const sortedEvents = [...events].sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
            return <GameBoard game={game} players={players} currentPlayer={currentPlayer} events={sortedEvents} messages={messages} />;
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
          key={bgImage.id} // This is crucial to force re-render on image change
          priority
        />
      )}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <GameMusic src={getMusicSrc()} />
      <div className="relative z-10 w-full flex items-center justify-center">
        {renderContent()}
      </div>
    </div>
  );
}
