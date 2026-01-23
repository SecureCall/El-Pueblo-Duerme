
"use client";

import { useState, useEffect } from 'react';
import type { Game, Player, GameEvent } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayerGrid } from '@/components/game/PlayerGrid';
import { useToast } from '@/hooks/use-toast';
import { submitVote, submitTroublemakerAction } from '@/lib/firebase-actions';
import { Loader2, Zap, Scale } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { HeartCrack, SunIcon, Users, BrainCircuit } from 'lucide-react';
import type { MasterActionState } from '@/components/game/MasterActionBar';

interface DayPhaseProps {
    game: Game;
    players: Player[];
    currentPlayer: Player;
    nightEvent?: GameEvent;
    loverDeathEvents?: GameEvent[];
    voteEvent?: GameEvent;
    behaviorClueEvent?: GameEvent;
}

function TroublemakerPanel({ game, currentPlayer, players }: { game: Game, currentPlayer: Player, players: Player[] }) {
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const [masterActionState, setMasterActionState] = useState<MasterActionState>({ active: false, actionId: null, sourceId: null });

    const handlePlayerSelect = (player: Player) => {
        if (!player.isAlive || player.userId === currentPlayer.userId) return;
        
        setSelectedPlayerIds(prev => {
            if (prev.includes(player.userId)) {
                return prev.filter(id => id !== player.userId);
            }
            if (prev.length < 2) {
                return [...prev, player.userId];
            }
            return [...prev.slice(1), player.userId];
        });
    };

    const handleSubmit = async () => {
        if (selectedPlayerIds.length !== 2) {
            toast({ variant: 'destructive', title: 'Debes seleccionar exactamente a dos jugadores.' });
            return;
        }

        setIsSubmitting(true);
        const result = await submitTroublemakerAction(game.id, currentPlayer.userId, selectedPlayerIds[0], selectedPlayerIds[1]);
        if (result.success) {
            toast({ title: '¡Caos desatado!', description: 'Has provocado una pelea mortal.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            setIsSubmitting(false);
        }
    };
    
    const target1 = players.find(p => p.userId === selectedPlayerIds[0]);
    const target2 = players.find(p => p.userId === selectedPlayerIds[1]);

    return (
        <Card className="bg-amber-900/30 border-amber-500/50 mt-4">
            <CardHeader>
                <CardTitle className="font-headline text-xl text-amber-400 flex items-center gap-2">
                    <Zap /> Acción de Alborotadora
                </CardTitle>
                <CardDescription>
                    Una vez por partida, puedes provocar una pelea mortal entre dos jugadores. Ambos serán eliminados.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-center mb-4 text-muted-foreground">Selecciona a dos jugadores para que se peleen.</p>
                <PlayerGrid 
                    game={game}
                    players={players.filter(p => p.isAlive && p.userId !== currentPlayer.userId)}
                    currentPlayer={currentPlayer}
                    onPlayerClick={handlePlayerSelect}
                    clickable={true}
                    selectedPlayerIds={selectedPlayerIds}
                    masterActionState={masterActionState} 
                    setMasterActionState={setMasterActionState}
                />
                <Button 
                    className="w-full mt-6 text-lg" 
                    onClick={handleSubmit} 
                    disabled={selectedPlayerIds.length !== 2 || isSubmitting}
                    variant="destructive"
                >
                    {isSubmitting 
                        ? <Loader2 className="animate-spin" /> 
                        : `Provocar Pelea entre ${target1?.displayName || '...'} y ${target2?.displayName || '...'}`
                    }
                </Button>
            </CardContent>
        </Card>
    );
}

export function DayPhase({ game, players, currentPlayer, nightEvent, loverDeathEvents = [], voteEvent, behaviorClueEvent }: DayPhaseProps) {
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const [masterActionState, setMasterActionState] = useState<MasterActionState>({ active: false, actionId: null, sourceId: null });

    const siren = players.find(p => p.role === 'river_siren');
    const isCharmed = siren?.riverSirenTargetId === currentPlayer.userId;
    const hasSirenVoted = !!siren?.votedFor;
    const isSirenAlive = !!siren?.isAlive;

    const canPlayerVote = !isCharmed || (isCharmed && isSirenAlive && hasSirenVoted);
    const hasVoted = !!currentPlayer.votedFor;
    const isTroublemaker = currentPlayer.role === 'troublemaker' && currentPlayer.isAlive && !game.troublemakerUsed;

    const tieData = voteEvent?.data?.tiedPlayerIds;
    const isTiebreaker = Array.isArray(tieData) && tieData.length > 0 && !voteEvent.data?.final;
    
    const votablePlayers = isTiebreaker 
      ? players.filter(p => p.isAlive && tieData.includes(p.userId))
      : players.filter(p => p.isAlive);

    useEffect(() => {
        setSelectedPlayerId(null);
    }, [isTiebreaker]);


    const handlePlayerSelect = (player: Player) => {
        if (hasVoted || !currentPlayer.isAlive || !player.isAlive || player.userId === currentPlayer.userId) return;
        setSelectedPlayerId(player.userId);
    };

    const handleVoteSubmit = async () => {
        if (!selectedPlayerId) {
            if (!isCharmed) { // Only show toast if not charmed, as charmed vote is automatic
                toast({ variant: 'destructive', title: 'Debes seleccionar un jugador para votar.' });
            }
            return;
        }

        setIsSubmitting(true);
        const result = await submitVote(game.id, currentPlayer.userId, selectedPlayerId);

        if (result.error) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
            setIsSubmitting(false); // Only re-enable on error
        } else {
             toast({ title: 'Voto registrado.' });
        }
    };
    
    const sirenVote = isCharmed && isSirenAlive && siren?.votedFor ? players.find(p => p.userId === siren.votedFor) : null;
    const votedForPlayer = players.find(p => p.userId === currentPlayer.votedFor);
    
    const votesByPlayer = players.filter(p => p.isAlive).reduce((acc, player) => {
        if (player.votedFor) {
            if (!acc[player.votedFor]) {
                acc[player.votedFor] = [];
            }
            const voter = players.find(p => p.userId === player.userId);
            if (voter) {
                acc[player.votedFor].push(voter.displayName);
            }
        }
        return acc;
    }, {} as Record<string, string[]>);

    return (
        <Card className="bg-card/80 w-full h-full">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">{isTiebreaker ? "Votación de Desempate" : "Debate y Votación"}</CardTitle>
                <CardDescription>
                    {isTiebreaker ? "El pueblo debe decidir entre los empatados." : "El pueblo se reúne. Discutid y votad para linchar a un sospechoso."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {nightEvent && !isTiebreaker && (
                    <Alert className='mb-4 bg-background/50'>
                        <SunIcon className="h-4 w-4" />
                        <AlertTitle>Al Amanecer...</AlertTitle>
                        <AlertDescription>
                            {nightEvent.message}
                        </AlertDescription>
                    </Alert>
                )}

                {loverDeathEvents.map(event => (
                    <Alert key={event.id} variant="destructive" className='mb-4 bg-destructive/20 border-destructive/50'>
                        <HeartCrack className="h-4 w-4" />
                        <AlertTitle>¡Una tragedia de amor!</AlertTitle>
                        <AlertDescription>
                            {event.message}
                        </AlertDescription>
                    </Alert>
                ))}

                {voteEvent && (
                    <Alert className='mb-4 bg-background/50 border-blue-400/30'>
                         {isTiebreaker ? <Scale className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                        <AlertTitle>{isTiebreaker ? "¡Empate!" : "Resultado de la Votación Anterior"}</AlertTitle>
                        <AlertDescription>
                            {voteEvent.message}
                        </AlertDescription>
                    </Alert>
                )}

                {behaviorClueEvent && (
                     <Alert className='mb-4 bg-yellow-900/30 border-yellow-400/50'>
                        <BrainCircuit className="h-4 w-4 text-yellow-300" />
                        <AlertTitle className='text-yellow-300'>Pista de Comportamiento</AlertTitle>
                        <AlertDescription>
                            {behaviorClueEvent.message}
                        </AlertDescription>
                    </Alert>
                )}
                
                {currentPlayer.isAlive ? (
                    hasVoted ? (
                        <div className="text-center py-4 space-y-4">
                             {isCharmed && (
                                <p className="text-lg text-cyan-300">
                                    Tu voto ha sido forzado por el canto de la Sirena.
                                </p>
                            )}
                            <p className="text-lg text-primary">
                                Has votado por {votedForPlayer?.displayName || 'alguien'}. Esperando al resto de jugadores...
                            </p>
                            <PlayerGrid 
                                game={game}
                                players={players.filter(p => p.isAlive)}
                                currentPlayer={currentPlayer}
                                votesByPlayer={votesByPlayer}
                                masterActionState={masterActionState} 
                                setMasterActionState={setMasterActionState}
                            />
                        </div>
                    ) : (
                        <>
                            {isCharmed && isSirenAlive && !hasSirenVoted && (
                                <Alert className="mb-4 bg-cyan-900/40 border-cyan-400/50 text-cyan-300">
                                    <AlertTitle>Hechizado por la Sirena</AlertTitle>
                                    <AlertDescription>
                                        Estás bajo el encanto de la Sirena del Río. Debes esperar a que vote para poder votar tú.
                                    </AlertDescription>
                                </Alert>
                            )}
                            {isCharmed && sirenVote && (
                                 <Alert className="mb-4 bg-cyan-900/40 border-cyan-400/50 text-cyan-300">
                                    <AlertTitle>Voto Forzado por la Sirena</AlertTitle>
                                    <AlertDescription>
                                        La Sirena ha votado. Tu voto será automáticamente para <strong>{sirenVote.displayName}</strong>.
                                    </AlertDescription>
                                </Alert>
                            )}

                            <p className="text-center mb-4 text-muted-foreground">{isTiebreaker ? "Debes elegir a uno de los empatados." : "Selecciona al jugador que crees que es un Hombre Lobo."}</p>
                            <PlayerGrid 
                                game={game}
                                players={votablePlayers}
                                currentPlayer={currentPlayer}
                                onPlayerClick={handlePlayerSelect}
                                clickable={canPlayerVote}
                                selectedPlayerIds={selectedPlayerId ? [selectedPlayerId] : []}
                                votesByPlayer={votesByPlayer}
                                masterActionState={masterActionState} 
                                setMasterActionState={setMasterActionState}
                            />
                            <Button 
                                className="w-full mt-6 text-lg" 
                                onClick={handleVoteSubmit} 
                                disabled={(!selectedPlayerId && !sirenVote) || isSubmitting || !canPlayerVote}
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : `Votar por ${sirenVote?.displayName || players.find(p=>p.userId === selectedPlayerId)?.displayName || '...'}`}
                            </Button>
                        </>
                    )
                ) : (
                    <div className="text-center py-4 space-y-4">
                        <p className="text-lg">Observas el debate desde el más allá...</p>
                        <PlayerGrid 
                            game={game}
                            players={players.filter(p => p.isAlive)}
                            currentPlayer={currentPlayer}
                            votesByPlayer={votesByPlayer}
                            masterActionState={masterActionState} 
                            setMasterActionState={setMasterActionState}
                        />
                    </div>
                )}
                
                {isTroublemaker && !isTiebreaker && <TroublemakerPanel game={game} currentPlayer={currentPlayer} players={players} />}

            </CardContent>
        </Card>
    );
}
