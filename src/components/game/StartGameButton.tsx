
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { startGame } from "@/lib/firebase-client-actions";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGameSession } from "@/hooks/use-game-session";
import type { Game } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface StartGameButtonProps {
  game: Game;
  playerCount: number;
}

const MINIMUM_PLAYERS = 3;

export function StartGameButton({ game, playerCount }: StartGameButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { userId, isSessionLoaded } = useGameSession();

  const totalPlayers = game.settings.fillWithAI ? game.maxPlayers : playerCount;
  const canStart = totalPlayers >= MINIMUM_PLAYERS;

  const handleStartGame = async () => {
    if (!isSessionLoaded || !userId) {
       toast({
          variant: "destructive",
          title: "Error",
          description: "La sesión no está cargada.",
        });
      return;
    }
    setIsLoading(true);
    const result = await startGame(game.id, userId);
    if (result.error) {
      toast({
        variant: "destructive",
        title: "No se puede iniciar la partida",
        description: result.error,
      });
      setIsLoading(false);
    }
    // On success, the component will unmount as the game status changes,
    // so no need to setIsLoading(false) on success.
  };

  const button = (
    <Button 
      onClick={handleStartGame} 
      disabled={isLoading || !canStart || !isSessionLoaded} 
      size="lg" 
      className="font-bold text-xl"
    >
      {isLoading ? <Loader2 className="animate-spin" /> : "Comenzar Partida"}
    </Button>
  );

  if (canStart) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-block" tabIndex={0}>
            {button}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Se necesitan al menos {MINIMUM_PLAYERS} jugadores para empezar.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
