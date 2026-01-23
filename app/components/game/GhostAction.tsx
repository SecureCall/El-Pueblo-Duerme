"use client";

import { useState } from "react";
import type { Game, Player } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { sendGhostMessage } from "@/lib/firebase-actions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Button } from "@/components/ui/button";
import { Ghost, Loader2 } from "lucide-react";
import { Textarea } from "../ui/textarea";

interface GhostActionProps {
    game: Game;
    currentPlayer: Player;
    players: Player[];
}

export function GhostAction({ game, currentPlayer, players }: GhostActionProps) {
    const [targetId, setTargetId] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!targetId) {
            toast({ variant: "destructive", title: "Debes elegir a un jugador." });
            return;
        }
        if (!message.trim()) {
            toast({ variant: "destructive", title: "Tu mensaje no puede estar vacío." });
            return;
        }
         if (message.length > 280) {
            toast({ variant: "destructive", title: "El mensaje es demasiado largo (máx. 280 caracteres)." });
            return;
        }


        setIsSubmitting(true);
        const result = await sendGhostMessage(game.id, currentPlayer.userId, targetId, message);
        setIsSubmitting(false);

        if (result.success) {
            toast({ title: "Mensaje enviado desde el más allá." });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };

    return (
        <Card className="mt-8 bg-blue-900/20 border-blue-400/40">
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center gap-2">
                    <Ghost className="text-blue-300" />
                    Acción de Fantasma
                </CardTitle>
                <CardDescription>
                    Has muerto, pero tienes una última oportunidad de influir en el juego. Envía una carta anónima a un jugador vivo. No puedes revelar roles directamente.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <label className="text-sm font-medium mb-2 block">Elige a quién enviar la carta:</label>
                     <Select onValueChange={setTargetId} value={targetId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona un jugador vivo..." />
                        </SelectTrigger>
                        <SelectContent>
                            {players.map(player => (
                                <SelectItem key={player.userId} value={player.userId}>
                                    {player.displayName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <label className="text-sm font-medium mb-2 block">Escribe tu mensaje (máx. 280 caracteres):</label>
                    <Textarea 
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Susurra tu sabiduría, siembra la duda, o confunde a todos..."
                        maxLength={280}
                        rows={4}
                    />
                </div>
               
                <Button 
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !targetId || !message.trim()}
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Enviar Mensaje Espectral"}
                </Button>
            </CardContent>
        </Card>
    );
}
