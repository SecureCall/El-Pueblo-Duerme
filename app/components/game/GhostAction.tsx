
"use client";

import { useState } from "react";
import type { Game, Player } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { sendGhostMessage } from "@/lib/firebase-client-actions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Ghost, Loader2 } from "lucide-react";
import { useFirebase } from "@/firebase";

interface GhostActionProps {
    game: Game;
    currentPlayer: Player;
    players: Player[];
}

const GHOST_MESSAGES = [
    "Confía en {player}",
    "Desconfía de {player}",
    "El peligro no es quien crees que es",
];

export function GhostAction({ game, currentPlayer, players }: GhostActionProps) {
    const [messageTemplate, setMessageTemplate] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { firestore } = useFirebase();

    const handleSubmit = async () => {
        if (!messageTemplate || !selectedPlayer) {
            toast({ variant: "destructive", title: "Debes elegir un mensaje y un jugador." });
            return;
        }
        if (!firestore) {
             toast({ variant: "destructive", title: "Error de conexión." });
             return;
        }

        let finalMessage = messageTemplate;
        if (messageTemplate.includes('{player}')) {
            const playerName = players.find(p => p.userId === selectedPlayer)?.displayName || 'alguien';
            finalMessage = messageTemplate.replace('{player}', playerName);
        }

        setIsSubmitting(true);
        const result = await sendGhostMessage(firestore, game.id, currentPlayer.userId, selectedPlayer, finalMessage);
        setIsSubmitting(false);

        if (result.success) {
            toast({ title: "Mensaje enviado desde el más allá." });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };

    const needsPlayerName = messageTemplate.includes('{player}');

    return (
        <Card className="mt-8 bg-blue-900/20 border-blue-400/40">
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center gap-2">
                    <Ghost className="text-blue-300" />
                    Acción de Fantasma
                </CardTitle>
                <CardDescription>
                    Has muerto, pero tienes una última oportunidad de influir en el juego. Envía un mensaje anónimo a un jugador vivo.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label className="text-sm font-medium mb-2 block">Elige tu susurro espectral:</Label>
                    <RadioGroup onValueChange={setMessageTemplate} value={messageTemplate} className="space-y-2">
                        {GHOST_MESSAGES.map(msg => (
                            <div key={msg} className="flex items-center space-x-2">
                                <RadioGroupItem value={msg} id={msg} />
                                <Label htmlFor={msg}>{msg.replace('{player}', 'un jugador...')}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>
                
                {messageTemplate && (
                     <div>
                        <Label className="text-sm font-medium mb-2 block">{needsPlayerName ? '¿A qué jugador quieres señalar?' : '¿A quién quieres enviar el mensaje?'}</Label>
                        <Select onValueChange={setSelectedPlayer} value={selectedPlayer}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un jugador..." />
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
                )}
               
                <Button 
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !messageTemplate || !selectedPlayer}
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Enviar Mensaje Espectral"}
                </Button>
            </CardContent>
        </Card>
    );
}

    
