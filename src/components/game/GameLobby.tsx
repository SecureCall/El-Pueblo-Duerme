
"use client";

import type { Game, Player } from "@/types";
import { StartGameButton } from "./StartGameButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Copy, Share2, Edit } from "lucide-react";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import Image from "next/image";
import { AvatarSelectionModal } from "./AvatarSelectionModal";
import { useGameSession } from "@/hooks/use-game-session";
import { useFirebase } from "@/firebase";
import { updatePlayerAvatar } from "@/lib/firebase-actions";
import { PlayerGrid } from "./PlayerGrid";
import type { MasterActionState } from "./MasterActionBar";

interface GameLobbyProps {
  game: Game;
  players: Player[];
  isCreator: boolean;
  currentPlayer: Player;
}

export function GameLobby({ game, players, isCreator, currentPlayer }: GameLobbyProps) {
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { userId } = useGameSession();
  const [canShare, setCanShare] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [masterActionState, setMasterActionState] = useState<MasterActionState>({ active: false, actionId: null, sourceId: null });

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      setCanShare(true);
    }
  }, []);

  const handleAvatarChange = async (newAvatarUrl: string) => {
    if (!firestore || !userId) return;
    const result = await updatePlayerAvatar(firestore, game.id, userId, newAvatarUrl);
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el avatar." });
    }
    setIsAvatarModalOpen(false);
  };

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
      // User cancellation is not an error
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

  return (
    <>
      <AvatarSelectionModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        onSelectAvatar={handleAvatarChange}
      />
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
      
        <PlayerGrid 
            creatorId={game.creator}
            players={players}
            currentPlayer={currentPlayer}
            onPlayerClick={(player) => {
                if(player.userId === currentPlayer.userId) {
                    setIsAvatarModalOpen(true);
                }
            }}
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

    