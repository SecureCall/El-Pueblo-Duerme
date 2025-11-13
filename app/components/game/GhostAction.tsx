

"use client";

import { useState } from "react";
import type { Game, Player } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { sendGhostMessage } from "@/lib/firebase-client-actions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Ghost, Loader2 } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";

interface GhostActionProps {
    game: Game;
    currentPlayer: Player;
    players: Player[];
}

const GHOST_MESSAGES = [
    "Confía en {player}",
    "Desconfía de {player}",
    "El peligro no es quien crees que es",
]

export function GhostAction({ game, currentPlayer, players }: GhostActionProps) {
    const [targetId, setTargetId] = useState<string>('');
    const [messageTemplate, setMessageTemplate] = useState('');
    const [secondaryTargetId, setSecondaryTargetId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        if (!messageTemplate) {
            toast({ variant: "destructive", title: "Debes elegir un mensaje." });
            return;
        }

        let finalMessage = messageTemplate;
        if (messageTemplate.includes('{player}')) {
            if (!secondaryTargetId) {
                toast({ variant: "destructive", title: "Debes elegir a un jugador para mencionar en el mensaje." });
                return;
            }
            const secondaryTarget = players.find(p => p.userId === secondaryTargetId);
            finalMessage = messageTemplate.replace('{player}', secondaryTarget?.displayName || 'alguien');
        } else {
             if (!targetId) {
                toast({ variant: "destructive", title: "Debes elegir a quién enviar la carta." });
                return;
            }
        }
        
        const finalTargetId = messageTemplate.includes('{player}') ? secondaryTargetId : targetId;
        if (!finalTargetId) {
             toast({ variant: "destructive", title: "Objetivo inválido." });
             return;
        }

        setIsSubmitting(true);
        const result = await sendGhostMessage(game.id, currentPlayer.userId, finalTargetId, finalMessage);
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
                    Has muerto, pero tienes una última oportunidad de influir en el juego. Envía una carta anónima a un jugador vivo.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <label className="text-sm font-medium mb-2 block">Elige tu susurro espectral:</label>
                    <RadioGroup onValueChange={setMessageTemplate} value={messageTemplate}>
                        {GHOST_MESSAGES.map(msg => (
                            <div key={msg} className="flex items-center space-x-2">
                                <RadioGroupItem value={msg} id={msg} />
                                <Label htmlFor={msg}>{msg.replace('{player}', 'un jugador...')}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>
                
                {messageTemplate.includes('{player}') ? (
                     <div>
                        <label className="text-sm font-medium mb-2 block">¿Sobre quién quieres susurrar?</label>
                        <Select onValueChange={setSecondaryTargetId} value={secondaryTargetId}>
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
                ) : (
                    <div>
                        <label className="text-sm font-medium mb-2 block">¿A quién quieres enviar el mensaje?</label>
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
                )}
               
                <Button 
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={isSubmitting || !messageTemplate}
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Enviar Mensaje Espectral"}
                </Button>
            </CardContent>
        </Card>
    );
}

  