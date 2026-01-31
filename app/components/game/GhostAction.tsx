
"use client";

import { useState } from "react";
import type { Game, Player } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { sendGhostMessage } from "@/lib/ai-callable-actions";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Ghost, Loader2 } from "lucide-react";

interface GhostActionProps {
    game: Game;
    currentPlayer: Player;
    players: Player[];
}

const GHOST_TEMPLATES = [
    { value: "Confía en {player}.", needsSubject: true },
    { value: "No confíes en {player}.", needsSubject: true },
    { value: "El voto contra {player} fue un error.", needsSubject: true },
    { value: "La Vidente debería investigar a {player}.", needsSubject: true },
    { value: "El pueblo se equivoca.", needsSubject: false },
    { value: "Hay un lobo entre vosotros que nadie sospecha.", needsSubject: false },
];


export function GhostAction({ game, currentPlayer, players }: GhostActionProps) {
    const [recipientId, setRecipientId] = useState('');
    const [template, setTemplate] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async () => {
        const selectedTemplate = GHOST_TEMPLATES.find(t => t.value === template);
        if (!recipientId || !template) {
            toast({ variant: "destructive", title: "Debes seleccionar un destinatario y un mensaje." });
            return;
        }
        if (selectedTemplate?.needsSubject && !subjectId) {
            toast({ variant: "destructive", title: "Debes elegir un jugador para señalar en el mensaje." });
            return;
        }


        setIsSubmitting(true);
        const result = await sendGhostMessage(game.id, currentPlayer.userId, recipientId, template, subjectId || undefined);
        setIsSubmitting(false);

        if (result.success) {
            toast({ title: "Mensaje enviado desde el más allá." });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };
    
    const selectedTemplateObject = GHOST_TEMPLATES.find(t => t.value === template);
    const needsSubject = !!selectedTemplateObject?.needsSubject;

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
                    <label className="text-sm font-medium mb-2 block">Elige un destinatario:</label>
                     <Select onValueChange={setRecipientId} value={recipientId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona a un jugador vivo..." />
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
                    <label className="text-sm font-medium mb-2 block">Elige tu mensaje críptico:</label>
                    <Select onValueChange={setTemplate} value={template}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecciona una plantilla de mensaje..." />
                        </SelectTrigger>
                        <SelectContent>
                            {GHOST_TEMPLATES.map(t => (
                                <SelectItem key={t.value} value={t.value}>
                                    {t.value.replace('{player}', '...')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 {needsSubject && (
                    <div>
                        <label className="text-sm font-medium mb-2 block">¿A qué jugador quieres señalar?</label>
                        <Select onValueChange={setSubjectId} value={subjectId}>
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
                    disabled={isSubmitting || !recipientId || !template || (needsSubject && !subjectId)}
                >
                    {isSubmitting ? <Loader2 className="animate-spin" /> : "Enviar Mensaje Espectral"}
                </Button>
            </CardContent>
        </Card>
    );
}
