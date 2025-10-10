"use client";

import type { Game, Player } from "@/types";
import { PlayerCard } from "./PlayerCard";
import { StartGameButton } from "./StartGameButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Copy } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";

interface GameLobbyProps {
  game: Game;
  players: Player[];
  isCreator: boolean;
}

export function GameLobby({ game, players, isCreator }: GameLobbyProps) {
  const { toast } = useToast();

  const copyGameId = () => {
    navigator.clipboard.writeText(game.id);
    toast({
      title: "ID de Partida Copiado",
      description: "¡Comparte el ID con tus amigos para que se unan!",
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-8">
      <Card className="text-center bg-card/80">
        <CardHeader>
          <CardTitle className="font-headline text-4xl">{game.name}</CardTitle>
          <CardDescription className="text-lg">
            Esperando jugadores... ({players.length}/{game.maxPlayers})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <p>Comparte este ID con tus amigos:</p>
            <div className="flex items-center justify-center gap-2">
                <p className="text-2xl font-bold tracking-widest bg-muted px-4 py-2 rounded-md font-mono">{game.id}</p>
                <Button variant="ghost" size="icon" onClick={copyGameId}>
                    <Copy className="h-5 w-5" />
                </Button>
            </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {players.map((player) => (
          <PlayerCard key={player.userId} player={player} />
        ))}
      </div>

      {isCreator && (
        <div className="text-center pt-4">
          <StartGameButton game={game} playerCount={players.length} />
        </div>
      )}
    </div>
  );
}
