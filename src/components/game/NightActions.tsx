
"use client";

import { useState, useEffect } from 'react';
import type { Game, Player, NightActionType, ChatMessage } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { PlayerGrid } from './PlayerGrid';
import { useToast } from '@/hooks/use-toast';
import { submitNightAction, getSeerResult } from '@/lib/firebase-actions';
import { Loader2, Heart, FlaskConical, Shield, AlertTriangle, BotIcon, Eye, Wand2, UserX } from 'lucide-react';
import { SeerResult } from './SeerResult';
import { useNightActions } from '@/hooks/use-night-actions';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useFirebase } from '@/firebase';
import { WolfChat } from './WolfChat';
import { FairyChat } from './FairyChat';

interface NightActionsProps {
    game: Game;
    players: Player[];
    currentPlayer: Player;
    wolfMessages: ChatMessage[];
    fairyMessages: ChatMessage[];
}

type HechiceraAction = 'poison' | 'save';

export function NightActions({ game, players, currentPlayer, wolfMessages, fairyMessages }: NightActionsProps) {
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [seerResult, setSeerResult] = useState<{ targetName: string; isWerewolf: boolean; } | null>(null);
    const [hechiceraAction, setHechiceraAction] = useState<HechiceraAction>('poison');
    const { firestore } = useFirebase();
    
    const { toast } = useToast();
    const { hasSubmitted } = useNightActions(game.id, game.currentRound, currentPlayer.userId);

    const isExecutioner = currentPlayer.role === 'executioner';
    const isCupidFirstNight = currentPlayer.role === 'cupid' && game.currentRound === 1;
    const isShapeshifterFirstNight = currentPlayer.role === 'shapeshifter' && game.currentRound === 1;
    const isVirginiaWoolfFirstNight = currentPlayer.role === 'virginia_woolf' && game.currentRound === 1;
    const isRiverSirenFirstNight = currentPlayer.role === 'river_siren' && game.currentRound === 1;
    const isWitch = currentPlayer.role === 'witch';
    const isLookout = currentPlayer.role === 'lookout' && !currentPlayer.lookoutUsed;
    const isSeekerFairy = currentPlayer.role === 'seeker_fairy' && !game.fairiesFound;
    const isResurrectorAngel = currentPlayer.role === 'resurrector_angel' && !currentPlayer.resurrectorAngelUsed;

    const isHechicera = currentPlayer.role === 'hechicera';
    const isWerewolfTeam = ['werewolf', 'wolf_cub'].includes(currentPlayer.role || '');
    const isVampire = currentPlayer.role === 'vampire';
    const isCultLeader = currentPlayer.role === 'cult_leader';
    const isFisherman = currentPlayer.role === 'fisherman';
    const isSilencer = currentPlayer.role === 'silencer';
    const isElderLeader = currentPlayer.role === 'elder_leader';
    const isBanshee = currentPlayer.role === 'banshee' && Object.keys(currentPlayer.bansheeScreams || {}).length < 2;
    const isFairyTeam = ['seeker_fairy', 'sleeping_fairy'].includes(currentPlayer.role || '');

    const hasUsedPoison = !!currentPlayer.potions?.poison;
    const hasUsedSave = !!currentPlayer.potions?.save;

    const hasPoison = isHechicera && !hasUsedPoison;
    const hasSavePotion = isHechicera && !hasUsedSave;
    
    const wolfCubRevengeActive = game.wolfCubRevengeRound === game.currentRound;
    const canFairiesKill = game.fairiesFound && !game.fairyKillUsed && isFairyTeam;

    useEffect(() => {
        if (isHechicera && !hasPoison && hasSavePotion) {
            setHechiceraAction('save');
        }
    }, [isHechicera, hasPoison, hasSavePotion]);
    
    let selectionLimit = 1;
    if (isWerewolfTeam && wolfCubRevengeActive) selectionLimit = 2;
    if (isCupidFirstNight) selectionLimit = 2;
    if (isLookout || currentPlayer.role === 'sleeping_fairy') selectionLimit = 0;


    const handlePlayerSelect = (player: Player) => {
        if (hasSubmitted || isLookout) return;
        
        if(isResurrectorAngel) {
             if (player.isAlive) {
                 toast({ variant: 'destructive', title: 'Regla del Ángel', description: 'Solo puedes resucitar a jugadores muertos.' });
                 return;
             }
        } else {
             if (!player.isAlive) return;
        }

        if (isCupidFirstNight && selectedPlayerIds.includes(player.userId)) {
             setSelectedPlayerIds(prev => prev.filter(id => id !== player.userId));
             return;
        }


        if (isWerewolfTeam && ['werewolf', 'wolf_cub'].includes(player.role || '')) return;
        if (isVampire && (player.biteCount || 0) >= 3) {
            toast({ variant: 'destructive', title: 'Regla del Vampiro', description: 'Esta persona ya no tiene más sangre que dar.' });
            return;
        }
        if (currentPlayer.role === 'doctor' && player.lastHealedRound === game.currentRound - 1) {
            toast({ variant: 'destructive', title: 'Regla del Doctor', description: 'No puedes proteger a la misma persona dos noches seguidas.' });
            return;
        }
        if (currentPlayer.role === 'hechicera' && hechiceraAction === 'save' && player.userId === currentPlayer.userId) {
             toast({ variant: 'destructive', title: 'Regla de la Hechicera', description: 'No puedes usar la poción de salvación en ti misma.' });
             return;
        }
        if (currentPlayer.role === 'guardian' && player.userId === currentPlayer.userId && (currentPlayer.guardianSelfProtects || 0) >= 1) {
            toast({ variant: 'destructive', title: 'Regla del Guardián', description: 'Solo puedes protegerte a ti mismo una vez por partida.' });
            return;
        }
        if (currentPlayer.role === 'priest' && player.userId === currentPlayer.userId && currentPlayer.priestSelfHealUsed) {
            toast({ variant: 'destructive', title: 'Regla del Sacerdote', description: 'Ya te has bendecido a ti mismo una vez.' });
            return;
        }
         if (isCultLeader && player.isCultMember) {
            toast({ description: `${player.displayName} ya es parte de tu culto.` });
            return;
        }
        if (isFisherman && game.boat?.includes(player.userId)) {
            toast({ description: `${player.displayName} ya está en tu barco.` });
            return;
        }


        setSelectedPlayerIds(prev => {
            if (prev.includes(player.userId)) {
                return prev.filter(id => id !== player.userId);
            }
            if (prev.length < selectionLimit) {
                return [...prev, player.userId];
            }
            if (selectionLimit === 1) {
                return [player.userId];
            }
            // For multi-selection roles
            return [...prev.slice(1), player.userId];
        });
    };

    const getActionType = (): NightActionType | null => {
        if (canFairiesKill) return 'fairy_kill';
        const apprenticeIsActive = currentPlayer.role === 'seer_apprentice' && game.seerDied;
        if (apprenticeIsActive) return 'seer_check';
        if (isShapeshifterFirstNight) return 'shapeshifter_select';
        if (isCupidFirstNight) return 'cupid_love';

        switch (currentPlayer.role) {
            case 'werewolf':
            case 'wolf_cub':
                return 'werewolf_kill';
            case 'seer': return 'seer_check';
            case 'doctor': return 'doctor_heal';
            case 'guardian': return 'guardian_protect';
            case 'priest': return 'priest_bless';
            case 'vampire': return 'vampire_bite';
            case 'cult_leader': return 'cult_recruit';
            case 'fisherman': return 'fisherman_catch';
            case 'virginia_woolf': return isVirginiaWoolfFirstNight ? 'virginia_woolf_link' : null;
            case 'river_siren': return isRiverSirenFirstNight ? 'river_siren_charm' : null;
            case 'silencer': return 'silencer_silence';
            case 'elder_leader': return 'elder_leader_exile';
            case 'witch': return 'witch_hunt';
            case 'banshee': return 'banshee_scream';
            case 'lookout': return 'lookout_spy';
            case 'seeker_fairy': return 'fairy_find';
            case 'resurrector_angel': return 'resurrect';
            case 'hechicera':
                if (hechiceraAction === 'poison') return 'hechicera_poison';
                if (hechiceraAction === 'save') return 'hechicera_save';
                return null;
            default: return null;
        }
    }

    const handleSubmit = async () => {
        if (!firestore) return;
        if (selectedPlayerIds.length !== selectionLimit && !isLookout && currentPlayer.role !== 'sleeping_fairy') {
            toast({ variant: 'destructive', title: `Debes seleccionar ${selectionLimit} jugador(es).` });
            return;
        }

        const actionType = getActionType();
        if (!actionType) return;
        
        setIsSubmitting(true);

        const result = await submitNightAction(firestore, {
            gameId: game.id,
            round: game.currentRound,
            playerId: currentPlayer.userId,
            actionType: actionType,
            targetId: selectedPlayerIds.join('|'),
        });
        
        if (result.success) {
            if (actionType === 'seer_check') {
                 const seerResultData = await getSeerResult(firestore, game.id, currentPlayer.userId, selectedPlayerIds[0]);
                if (seerResultData.success) {
                    setSeerResult({
                        targetName: seerResultData.targetName!,
                        isWerewolf: seerResultData.isWerewolf!,
                    });
                } else {
                     toast({ variant: 'destructive', title: 'Error del Vidente', description: seerResultData.error });
                }
            } else {
                toast({ title: 'Acción registrada.', description: 'Tu decisión ha sido guardada.' });
            }
        } else {
             toast({ variant: 'destructive', title: 'Error', description: result.error });
             setIsSubmitting(false); // Only re-enable on error
        }
    };
    
    const otherWerewolves = isWerewolfTeam
        ? players.filter(p => p.isAlive && ['werewolf', 'wolf_cub'].includes(p.role || '') && p.userId !== currentPlayer.userId) 
        : [];
    
    const getActionPrompt = () => {
        if (game.exiledPlayerId === currentPlayer.userId) {
            return 'Has sido exiliado por la Anciana Líder esta noche. No puedes usar tu habilidad.';
        }
        if (canFairiesKill) {
            return '¡Las hadas están unidas! Elegid a quién lanzar la maldición. Este poder solo se puede usar una vez.';
        }
        const apprenticeIsActive = currentPlayer.role === 'seer_apprentice' && game.seerDied;
        switch (currentPlayer.role) {
            case 'werewolf':
            case 'wolf_cub':
                return wolfCubRevengeActive ? '¡Venganza! La cría ha muerto. Elegid a dos aldeanos para eliminar.' : 'Elige a un aldeano para eliminar.';
            case 'seer': return 'Elige a un jugador para descubrir su identidad.';
            case 'doctor': return 'Elige a un jugador para proteger esta noche.';
            case 'guardian': return 'Elige a un jugador para proteger esta noche. Puedes protegerte a ti mismo una vez por partida.';
            case 'priest': return 'Elige a un jugador para otorgarle tu bendición y protegerlo de todo mal.';
            case 'hechicera': return (hasPoison || hasSavePotion) ? 'Elige una poción y un objetivo.' : 'Has usado todas tus pociones.';
            case 'cupid': return game.currentRound === 1 ? 'Elige a dos jugadores para que se enamoren perdidamente.' : 'Tus flechas ya han sido lanzadas.';
            case 'vampire': return 'Elige un jugador para morder y acercarte a tu victoria.';
            case 'cult_leader': return 'Elige un nuevo miembro para unir a tu culto.';
            case 'fisherman': return 'Elige a un jugador para subir a tu barco. ¡Cuidado con los lobos!';
            case 'shapeshifter': return game.currentRound === 1 ? 'Elige un jugador. Si muere, te convertirás en él.' : 'Tu destino está ligado al de otra persona.';
            case 'virginia_woolf': return game.currentRound === 1 ? 'Elige un jugador. Si tú mueres, él morirá contigo.' : 'Tu destino está ligado al de otra persona.';
            case 'river_siren': return game.currentRound === 1 ? 'Elige un jugador para hechizarlo con tu canto.' : 'Tu canto ya ha embrujado a alguien.';
            case 'silencer': return 'Elige a un jugador para que no pueda hablar mañana.';
            case 'elder_leader': return 'Elige a un jugador para exiliarlo la próxima noche (no podrá usar habilidades).';
            case 'seer_apprentice': return apprenticeIsActive ? 'La vidente ha muerto. Has heredado su don. Elige a quién investigar.' : 'Aún eres un aprendiz. Espera tu momento.';
            case 'witch': return game.witchFoundSeer ? 'Has encontrado a la vidente. Los lobos te protegerán.' : 'Busca a la vidente entre los jugadores.';
            case 'banshee': return isBanshee ? 'Lanza tu grito y sentencia a un jugador.' : 'Ya has usado tus dos gritos en esta partida.';
            case 'lookout': return 'Puedes arriesgarte a espiar a los lobos. Si tienes éxito, los conocerás. Si fallas, morirás.';
            case 'seeker_fairy': return game.fairiesFound ? '¡Has encontrado al Hada Durmiente!' : 'Elige a un jugador para saber si es el Hada Durmiente.';
            case 'sleeping_fairy': return game.fairiesFound ? '¡El Hada Buscadora te ha encontrado!' : 'Duermes, esperando una conexión mágica.';
            case 'resurrector_angel': return isResurrectorAngel ? 'Elige a un jugador muerto para devolverle la vida. Solo puedes usar este poder una vez.' : 'Ya has usado tu poder de resurrección.';
            case 'executioner':
                 const target = players.find(p => p.userId === currentPlayer.executionerTargetId);
                 return target ? `Tu objetivo es que el pueblo linche a ${target.displayName}.` : 'Se te está asignando un objetivo...';
            default: return 'No tienes acciones esta noche. Espera al amanecer.';
        }
    }

    const renderWerewolfInfo = () => {
        if (!isWerewolfTeam) return null;

        return (
            <div className="mb-4 text-center">
                 {wolfCubRevengeActive && (
                    <Alert variant="destructive" className="mb-4 bg-destructive/20 border-destructive text-destructive-foreground">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>¡Venganza de la Cría de Lobo!</AlertTitle>
                        <AlertDescription>
                            La cría de lobo ha muerto. Esta noche, podéis eliminar a dos jugadores.
                        </AlertDescription>
                    </Alert>
                )}
                <p>Tus compañeros lobos:</p>
                <div className="flex justify-center gap-4 mt-2">
                    {otherWerewolves.length > 0 ? otherWerewolves.map(wolf => (
                        <div key={wolf.userId} className="flex flex-col items-center text-sm">
                            <BotIcon className="h-6 w-6 text-destructive" />
                            <span>{wolf.displayName}</span>
                        </div>
                    )) : <p className='text-sm text-muted-foreground'>Estás solo esta noche.</p>}
                </div>
            </div>
        )
    }
    
    const renderHechiceraInfo = () => {
        if (currentPlayer.role !== 'hechicera') return null;
        
        if (!hasPoison && !hasSavePotion) return null;

        return (
            <div className="mb-4 flex justify-center">
                <ToggleGroup 
                    type="single" 
                    value={hechiceraAction} 
                    onValueChange={(value: HechiceraAction) => {
                        if (value) {
                            setHechiceraAction(value);
                            setSelectedPlayerIds([]);
                        }
                    }}
                    className='w-auto'
                >
                    <ToggleGroupItem value="poison" aria-label="Usar veneno" disabled={!hasPoison}>
                        <FlaskConical className="h-4 w-4 mr-2" />
                        Veneno
                    </ToggleGroupItem>
                    <ToggleGroupItem value="save" aria-label="Usar poción de salvación" disabled={!hasSavePotion}>
                        <Shield className="h-4 w-4 mr-2" />
                        Salvar
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>
        )
    }

    const apprenticeIsActive = currentPlayer.role === 'seer_apprentice' && !!game.seerDied;

    const canPerformAction = (
        (
            isWerewolfTeam || 
            currentPlayer.role === 'seer' || 
            currentPlayer.role === 'doctor' ||
            currentPlayer.role === 'guardian' ||
            currentPlayer.role === 'priest' ||
            isVampire ||
            isCultLeader ||
            isFisherman ||
            (isHechicera && (hasPoison || hasSavePotion)) ||
            isCupidFirstNight ||
            isShapeshifterFirstNight ||
            isVirginiaWoolfFirstNight ||
            isRiverSirenFirstNight ||
            isSilencer ||
            isElderLeader ||
            isWitch ||
            isBanshee ||
            isLookout ||
            apprenticeIsActive ||
            isSeekerFairy ||
            canFairiesKill ||
            isResurrectorAngel
        ) && game.exiledPlayerId !== currentPlayer.userId
    );

    if (seerResult) {
        return <SeerResult targetName={seerResult.targetName} isWerewolf={seerResult.isWerewolf} />;
    }

    if (hasSubmitted) {
        return (
             <Card className="mt-8 bg-card/80">
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">Acciones Nocturnas</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-8">
                    <p className="text-lg text-primary">Has realizado tu acción. Espera a que amanezca.</p>
                      {(isWerewolfTeam || (game.fairiesFound && isFairyTeam)) && (
                        <div className="mt-6">
                           {isWerewolfTeam && <WolfChat gameId={game.id} currentPlayer={currentPlayer} messages={wolfMessages} />}
                           {game.fairiesFound && isFairyTeam && <FairyChat gameId={game.id} currentPlayer={currentPlayer} messages={fairyMessages} />}
                        </div>
                    )}
                </CardContent>
            </Card>
        )
    }


    const playersForGrid = isResurrectorAngel ? game.players.filter(p => !p.isAlive) : players.filter(p=>p.isAlive);

    return (
        <Card className="mt-8 bg-card/80">
            <CardHeader>
                <CardTitle className="font-headline text-2xl">Tus Acciones Nocturnas</CardTitle>
                <CardDescription>{getActionPrompt()}</CardDescription>
            </CardHeader>
            <CardContent>
                {renderWerewolfInfo()}
                {renderHechiceraInfo()}
                {isExecutioner ? (
                     <div className="text-center py-8">
                        <p className="text-lg text-muted-foreground">No tienes acciones esta noche. Tu trabajo empieza durante el día.</p>
                    </div>
                ) : canPerformAction ? (
                    <>
                        {(!isLookout && currentPlayer.role !== 'sleeping_fairy') && (
                            <PlayerGrid 
                                players={playersForGrid.filter(p => {
                                    if (isResurrectorAngel) return true; // Show all dead players
                                    if (isWerewolfTeam) {
                                        // A witch who found the seer is an ally
                                        if (game.witchFoundSeer && p.role === 'witch') return false;
                                        return !['werewolf', 'wolf_cub'].includes(p.role || '');
                                    }
                                    if (isCupidFirstNight) return true; // Cupid can target anyone
                                    if (canFairiesKill && ['seeker_fairy', 'sleeping_fairy'].includes(p.role || '')) return false;
                                    if (isVampire) return p.role !== 'vampire';
                                    if (isCultLeader) return p.userId !== currentPlayer.userId && !p.isCultMember;
                                    if (isFisherman) return p.userId !== currentPlayer.userId && !game.boat?.includes(p.userId);
                                    if (isSilencer || isElderLeader) return p.userId !== currentPlayer.userId;
                                    if (p.userId === currentPlayer.userId) {
                                        if (currentPlayer.role === 'priest' && !currentPlayer.priestSelfHealUsed) return true;
                                        if (currentPlayer.role === 'guardian' && (currentPlayer.guardianSelfProtects || 0) < 1) return true;
                                        // Hechicera cannot save self
                                        if (currentPlayer.role === 'hechicera' && hechiceraAction === 'save') return false;
                                        // By default, cannot target self unless specified above.
                                        return false; 
                                    }
                                    return true;
                                })}
                                onPlayerClick={handlePlayerSelect}
                                clickable={true}
                                selectedPlayerIds={selectedPlayerIds}
                            />
                        )}
                         { (isWerewolfTeam && wolfCubRevengeActive) || isCupidFirstNight ? (
                            <div className="flex justify-center items-center gap-4 mt-4">
                                <span className='text-lg'>{players.find(p => p.userId === selectedPlayerIds[0])?.displayName || '?'}</span>
                                <span className='text-destructive font-bold'>&</span>
                                <span className='text-lg'>{players.find(p => p.userId === selectedPlayerIds[1])?.displayName || '?'}</span>
                            </div>
                        ) : null}
                        <Button 
                            className="w-full mt-6 text-lg" 
                            onClick={handleSubmit} 
                            disabled={(selectedPlayerIds.length !== selectionLimit && !isLookout && currentPlayer.role !== 'sleeping_fairy') || isSubmitting}
                        >
                            {isSubmitting 
                                ? <Loader2 className="animate-spin" /> 
                                : (isLookout ? <><Eye className="mr-2" /> Intentar Espiar</> : 
                                  (canFairiesKill ? <><Wand2 className="mr-2" /> Lanzar Maldición</> : 
                                  (isCupidFirstNight ? <><Heart className="mr-2" /> Crear Pareja</> : 'Confirmar Acción')))
                            }
                        </Button>
                    </>
                ) : (
                    <p className="text-center text-muted-foreground py-8">Duermes profundamente...</p>
                )}

                {(isWerewolfTeam || (game.fairiesFound && isFairyTeam)) && (
                    <div className="mt-6">
                       {isWerewolfTeam && <WolfChat gameId={game.id} currentPlayer={currentPlayer} messages={wolfMessages} />}
                       {game.fairiesFound && isFairyTeam && <FairyChat gameId={game.id} currentPlayer={currentPlayer} messages={fairyMessages} />}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
