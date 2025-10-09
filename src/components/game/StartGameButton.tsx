"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { startGame } from "@/app/actions";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGameSession } from "@/hooks/use-game-session";

interface StartGameButtonProps {
  gameId: string;
  playerCount: number;
}

export function StartGameButton({ gameId, playerCount }: StartGameButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { userId } = useGameSession();
  const canStart = playerCount >= 3;

  const handleStartGame = async () => {
    setIsLoading(true);
    const result = await startGame(gameId, userId); // creatorId check is on server
    if (result.error) {
      toast({
        variant: "destructive",
        title: "No se puede iniciar la partida",
        description: result.error,
      });
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleStartGame} 
      disabled={isLoading || !canStart} 
      size="lg" 
      className="font-bold text-xl"
    >
      {isLoading ? <Loader2 className="animate-spin" /> : "Comenzar Partida"}
    </Button>
  );
}
