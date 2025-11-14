"use client";

import { useState } from 'react';
import type { Game, Player } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { PlayerGrid } from './PlayerGrid';
import { useToast } from '@/hooks/use-toast';
import { submitJuryVote } from '@/lib/firebase-actions';
import { Loader2, Scale } from 'lucide-react';
import type { MasterActionState } from './MasterActionBar';

interface JuryVoteProps {
    game: Game;
    players: Player[];
    currentPlayer: Player;
    tiedPlayerIds: string[];
}

export function JuryVote({ game, players, currentPlayer, tiedPlayerIds }: JuryVoteProps) {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const hasVoted = game.juryVotes && game.juryVotes[currentPlayer.userId];

    const [masterActionState, setMasterActionState] = useState<MasterActionState>({ active: false, actionId: null, sourceId: null });

    const handlePlayerSelect = (player: Player) => {
        if (hasVoted) return;
        setSelectedPlayerId(player.userId);
    };

    const handleVoteSubmit = async () => {
        if (!selectedPlayerId) {
            toast({ variant: 'destructive', title: 'Debes seleccionar un jugador para condenar.' });
            return;
        }

        setIsSubmitting(true);
        const result = await submitJuryVote(game.id, currentPlayer.userId, selectedPlayerId);

        if (result.error) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            setIsSubmitting(false);
        } else {
             toast({ title: 'Voto del jurado registrado.' });
        }
    };
    
    const tiedPlayers = players.filter(p => tiedPlayerIds.includes(p.userId));

    return (
        <Card className="bg-gray-800/80 border-yellow-400/50 w-full h-full">
            <CardHeader>
                <CardTitle className="font-headline text-2xl text-yellow-300 flex items-center gap-2">
                    <Scale /> Voto del Jurado
                </CardTitle>
                <CardDescription>
                    Hubo un empate. Como espíritu, tu voto decidirá quién será linchado.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {hasVoted ? (
                     <div className="text-center py-4 space-y-4">
                        <p className="text-lg text-primary">
                            Has votado por {players.find(p=>p.userId === hasVoted)?.displayName}. Esperando al resto del jurado...
                        </p>
                    </div>
                ) : (
                    <>
                         <p className="text-center mb-4 text-muted-foreground">Elige a uno de los empatados para eliminarlo.</p>
                         <PlayerGrid 
                            game={game}
                            players={tiedPlayers}
                            currentPlayer={currentPlayer}
                            onPlayerClick={handlePlayerSelect}
                            clickable={true}
                            selectedPlayerIds={selectedPlayerId ? [selectedPlayerId] : []}
                            masterActionState={masterActionState}
                            setMasterActionState={setMasterActionState}
                        />
                         <Button 
                            className="w-full mt-6 text-lg" 
                            onClick={handleVoteSubmit} 
                            disabled={!selectedPlayerId || isSubmitting}
                            variant="destructive"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" /> : `Condenar a ${players.find(p=>p.userId === selectedPlayerId)?.displayName || '...'}`}
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

    
