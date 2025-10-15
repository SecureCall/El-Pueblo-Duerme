
"use client";

import type { Game, Player } from "@/types";
import { PlayerCard } from "./PlayerCard";
import { StartGameButton } from "./StartGameButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Copy, Share2 } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { playNarration } from "@/lib/sounds";
import { useEffect, useState } from "react";

interface GameLobbyProps {
  game: Game;
  players: Player[];
  isCreator: boolean;
}

export function GameLobby({ game, players, isCreator }: GameLobbyProps) {
  const { toast } = useToast();
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (navigator.share) {
      setCanShare(true);
    }
  }, []);

  const copyGameId = () => {
    navigator.clipboard.writeText(game.id);
    toast({
      title: "ID de Partida Copiado",
      description: "¡Comparte el ID con tus amigos para que se unan!",
    });
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/game/${game.id}`;
    const shareData = {
      title: `¡Únete a mi partida de El Pueblo Duerme!`,
      text: `Entra a la sala "${game.name}" con el ID: ${game.id}\nO usa este enlace:`,
      url: shareUrl,
    };

    try {
      await navigator.share(shareData);
      toast({
        title: "¡Enlace compartido!",
      });
    } catch (err) {
      // This can happen if the user cancels the share dialog
      if ((err as Error).name !== 'AbortError') {
        console.error("Share failed:", err);
        toast({
          variant: "destructive",
          title: "Error al compartir",
          description: "No se pudo compartir el enlace. Puedes copiar el ID manualmente.",
        });
      }
    }
  };

  const handleStartGame = () => {
    playNarration('noche_pueblo_duerme.mp3');
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
                    <span className="sr-only">Copiar ID</span>
                </Button>
                 {canShare && (
                  <Button variant="ghost" size="icon" onClick={handleShare}>
                    <Share2 className="h-5 w-5" />
                    <span className="sr-only">Compartir enlace</span>
                  </Button>
                )}
            </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {players.map((player) => (
          <PlayerCard key={player.userId} player={player} />
        ))}
      </div>

      {isCreator && (
        <div className="text-center pt-4" onClick={handleStartGame}>
          <StartGameButton game={game} playerCount={players.length} />
        </div>
      )}
    </div>
  );
}
