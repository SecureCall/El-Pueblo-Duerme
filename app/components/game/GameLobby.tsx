
"use client";

import type { Game, Player } from "@/types";
import { StartGameButton } from "@/components/game/StartGameButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Share2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useGameSession } from "@/hooks/use-game-session";
import { PlayerGrid } from "@/components/game/PlayerGrid";
import type { MasterActionState } from "@/components/game/MasterActionBar";
import Link from "next/link";

interface GameLobbyProps {
  game: Game;
  players: Player[];
  isCreator: boolean;
}

export function GameLobby({ game, players, isCreator }: GameLobbyProps) {
  const { toast } = useToast();
  const { userId, setAvatarUrl, currentPlayer } = useGameSession();
  const [canShare, setCanShare] = useState(false);
  const [masterActionState, setMasterActionState] = useState<MasterActionState>({ active: false, actionId: null, sourceId: null });


  useEffect(() => {
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
    try {
      await navigator.share({
        title: `¡Únete a mi partida de El Pueblo Duerme!`,
        text: shareText,
        url: shareUrl,
      });
      toast({ title: "¡Enlace compartido!" });
    } catch (err) {
      // Safely ignore abort errors
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error("Share failed:", err);
        toast({
          variant: "destructive",
          title: "Error al compartir",
          description: "No se pudo compartir. Copia el ID manualmente.",
        });
      }
    }
  };

  if (!currentPlayer) return null;

  return (
    <>
      <div className="w-full max-w-4xl mx-auto p-4 space-y-8">
        <Card className="text-center bg-card/80">
          <CardHeader>
            <div className="flex justify-between items-center">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/profile">
                        <User />
                        <span className="sr-only">Ver Perfil</span>
                    </Link>
                </Button>
                <div className="flex-1">
                    <CardTitle className="font-headline text-4xl">{game.name}</CardTitle>
                    <CardDescription className="text-lg">
                    Esperando jugadores... ({players.length}/{game.maxPlayers})
                    </CardDescription>
                </div>
                <div className="w-10"></div>
            </div>
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
      
        <PlayerGrid 
            game={game}
            players={players}
            currentPlayer={currentPlayer}
            onPlayerClick={(player) => {
                if(player.userId === currentPlayer.userId) {
                    toast({ title: 'Cambiar avatar', description: 'Esta función estará disponible pronto.' });
                }
            }}
            clickable={true}
            masterActionState={masterActionState}
            setMasterActionState={setMasterActionState}
        />

        {isCreator && (
            <div className="text-center pt-4">
            <StartGameButton game={game} playerCount={players.length} />
            </div>
        )}
      </div>
    </>
  );
}

    

    