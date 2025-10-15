
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
import Image from "next/image";

interface GameLobbyProps {
  game: Game;
  players: Player[];
  isCreator: boolean;
}

export function GameLobby({ game, players, isCreator }: GameLobbyProps) {
  const { toast } = useToast();
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // navigator.share is only available in secure contexts (HTTPS)
    if (typeof navigator !== 'undefined' && navigator.share) {
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

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/game/${game.id}` : '';
  const shareText = `¡Únete a mi partida de El Pueblo Duerme! Entra a la sala "${game.name}" con el ID: ${game.id}`;
  const fullShareText = `${shareText}\nO usa este enlace: ${shareUrl}`;


  const handleShare = async () => {
    if (!canShare) return;

    const shareData = {
      title: `¡Únete a mi partida de El Pueblo Duerme!`,
      text: shareText,
      url: shareUrl,
    };

    try {
      await navigator.share(shareData);
      toast({
        title: "¡Enlace compartido!",
      });
    } catch (err) {
      // The AbortError is thrown when the user cancels the share dialog.
      // The NotAllowedError is thrown if the browser denies the request for other reasons.
      // In both cases, we should not show an error message to the user.
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
        console.log(`Share action was not completed: ${err.name}`);
      } else {
        console.error("Share failed:", err);
        toast({
          variant: "destructive",
          title: "Error al compartir",
          description: "No se pudo compartir el enlace. Puedes copiar el ID manualmente.",
        });
      }
    }
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
                 <Button variant="ghost" size="icon" asChild>
                   <a 
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(fullShareText)}`}
                      data-action="share/whatsapp/share"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Image src="/whatsapp.png" alt="Compartir por WhatsApp" width={24} height={24} />
                      <span className="sr-only">Compartir por WhatsApp</span>
                   </a>
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
        <div className="text-center pt-4">
          <StartGameButton game={game} playerCount={players.length} />
        </div>
      )}
    </div>
  );
}
