'use client';

import type { Game, Player, GameEvent, ChatMessage } from "@/types";
import { RoleReveal } from "./RoleReveal";
import { PlayerGrid } from "./PlayerGrid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { useEffect, useState, useRef, useCallback } from "react";
import { useFirebase } from "@/firebase";
import { NightActions } from "./NightActions";
import { processNight, processVotes, setPhaseToNight, triggerAIVote, runAIActions } from "@/lib/firebase-actions";
import { DayPhase } from "./DayPhase";
import { GameOver } from "./GameOver";
import { Heart, Moon, Sun, Users2, Wand2, Loader2, UserX } from "lucide-react";
import { HunterShot } from "./HunterShot";
import { GameChronicle } from "./GameChronicle";
import { PhaseTimer } from "./PhaseTimer";
import { CurrentPlayerRole } from "./CurrentPlayerRole";
import { playNarration, playSoundEffect } from "@/lib/sounds";
import { YouAreDeadOverlay } from "./YouAreDeadOverlay";
import { BanishedOverlay } from "./BanishedOverlay";
import { HunterKillOverlay } from "./HunterKillOverlay";
import { GhostAction } from "./GhostAction";
import { GameChat } from "./GameChat";
import { TwinChat } from "./TwinChat";
import { FairyChat } from "./FairyChat";
import { VampireKillOverlay } from "./VampireKillOverlay";
import { useGameState } from "@/hooks/use-game-state";
import { LoversChat } from "./LoversChat";
import { getMillis } from "@/lib/utils";
import { GhostChat } from "@/components/game/GhostChat";


interface GameBoardProps {
  game: Game;
  players: Player[];
  currentPlayer: Player | null;
  events: GameEvent[];
  messages: ChatMessage[];
  wolfMessages: ChatMessage[];
  fairyMessages: ChatMessage[];
  twinMessages: ChatMessage[];
  loversMessages: ChatMessage[];
  ghostMessages: ChatMessage[];
}

export function GameBoard({ 
    game: initialGame, 
    players: initialPlayers, 
    currentPlayer: initialCurrentPlayer, 
    events: initialEvents, 
    messages: initialMessages, 
    wolfMessages: initialWolfMessages, 
    fairyMessages: initialFairyMessages, 
    twinMessages: initialTwinMessages,
    loversMessages: initialLoversMessages,
    ghostMessages: initialGhostMessages,
}: GameBoardProps) {
  const { firestore } = useFirebase();
  const { game, players, currentPlayer, events, messages, wolfMessages, fairyMessages, twinMessages, loversMessages, ghostMessages } = useGameState(initialGame.id, {
    initialGame,
    initialPlayers,
    initialCurrentPlayer,
    initialEvents,
    initialMessages,
    initialWolfMessages,
    initialFairyMessages,
    initialTwinMessages,
    initialLoversMessages,
    initialGhostMessages,
  });
  
  const prevPhaseRef = useRef<Game['phase']>();
  const [showRole, setShowRole] = useState(true);
  const [deathCause, setDeathCause] = useState<GameEvent['type'] | 'other' | null>(null);
  const nightSoundsPlayedForRound = useRef<number>(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const handlePhaseEnd = useCallback(async () => {
    if (!firestore || !game || !currentPlayer) return;
    if (game.status === 'finished') return;
    
    // Any player can trigger the phase end as a failsafe.
    // The backend functions are idempotent.
    if (game.phase === 'day' && game.creator === currentPlayer.userId) {
        await processVotes(firestore, game.id);
    } else if (game.phase === 'night' && game.creator === currentPlayer.userId) {
        await processNight(firestore, game.id);
    }
  }, [firestore, game, currentPlayer]);


  // Sound and action trigger logic
  useEffect(() => {
    if (!game || !currentPlayer || game.status === 'finished') return;
    const prevPhase = prevPhaseRef.current;

    if (prevPhase !== game.phase) {
      switch (game.phase) {
        case 'night':
          if (game.currentRound === 1 && prevPhase === 'role_reveal') {
             playNarration('intro_epica.mp3');
             setTimeout(() => playNarration('noche_pueblo_duerme.mp3'), 4000);
          } else {
            playNarration('noche_pueblo_duerme.mp3');
          }
           if (firestore && game.creator === currentPlayer?.userId) {
                runAIActions(firestore, game.id);
            }
          break;
        case 'day':
          playSoundEffect('/audio/rooster-crowing-364473.mp3');
          playNarration('dia_pueblo_despierta.mp3');
          setTimeout(() => {
            playNarration('inicio_debate.mp3');
            if (firestore && game.creator === currentPlayer?.userId) {
                triggerAIVote(firestore, game.id);
            }
          }, 2000);
          break;
      }
    }
    
    prevPhaseRef.current = game.phase;

    const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
    if (nightEvent && nightSoundsPlayedForRound.current !== game.currentRound) {
        const hasDeaths = (nightEvent.data?.killedPlayerIds?.length || 0) > 0;
        const wasSaved = !hasDeaths && ((nightEvent.data?.savedPlayerIds?.length || 0) > 0);
        
        setTimeout(() => {
            if (hasDeaths) {
                playNarration('Descanse en paz.mp3');
            } else if (wasSaved) {
                playNarration('¡Milagro!.mp3');
            }
        }, 3000); 
        nightSoundsPlayedForRound.current = game.currentRound; 
    }

  }, [game?.phase, game?.currentRound, events, players, firestore, game, currentPlayer]);

    const getCauseOfDeath = (playerId: string): GameEvent['type'] | 'other' => {
        const deathEvent = [...events]
            .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt))
            .find(e => {
                const data = e.data || {};
                if (data.killedPlayerId === playerId) return true;
                if (Array.isArray(data.killedPlayerIds) && data.killedPlayerIds.includes(playerId)) return true;
                if (data.lynchedPlayerId === playerId) return true;
                return false;
            });
        
        return deathEvent?.type || 'other';
    };


    useEffect(() => {
        if (!currentPlayer || currentPlayer.isAlive) {
            setDeathCause(null);
            return;
        };
        setDeathCause(getCauseOfDeath(currentPlayer.userId));
    }, [currentPlayer?.isAlive, events, currentPlayer?.userId]);
  
  // Auto-advance from role reveal
  useEffect(() => {
    if (!game || !currentPlayer) return;
    if (game.phase === 'role_reveal' && game.creator === currentPlayer.userId && firestore && game.status === 'in_progress') {
      const timer = setTimeout(() => {
        setPhaseToNight(firestore, game.id);
      }, 15000); 

      return () => clearTimeout(timer);
    }
  }, [game?.phase, game?.id, game?.creator, currentPlayer?.userId, firestore, game?.status]);
  
  // Phase timer logic
  useEffect(() => {
    if (!game?.phaseEndsAt || !firestore || !game || game.status === 'finished') {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const endTime = getMillis(game.phaseEndsAt);
      const remaining = Math.max(0, endTime - now);
      setTimeLeft(Math.round(remaining / 1000));

      if (remaining <= 0) {
        handlePhaseEnd();
        clearInterval(interval); 
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [game?.phaseEndsAt, game?.id, firestore, game, handlePhaseEnd]);

  if (!game || !currentPlayer) {
      return null;
  }
  
  if (game.status === 'finished') {
    const gameOverEvent = events.find(e => e.type === 'game_over');
    return <GameOver game={game} event={gameOverEvent} players={players} />;
  }

  if (currentPlayer.role && game.phase === 'role_reveal' && showRole) {
      return <RoleReveal player={currentPlayer} onAcknowledge={() => setShowRole(false)} />;
  }

  if (!currentPlayer.isAlive && game.status === 'in_progress') {
     const isAngelInPlay = !!(game.settings.resurrector_angel && players.some(p => p.role === 'resurrector_angel' && p.isAlive && !p.resurrectorAngelUsed));
     
     const renderDeathOverlay = () => {
        switch (deathCause) {
            case 'vote_result': return <BanishedOverlay angelInPlay={isAngelInPlay} />;
            case 'hunter_shot': return <HunterKillOverlay angelInPlay={isAngelInPlay} />;
            case 'vampire_kill': return <VampireKillOverlay angelInPlay={isAngelInPlay} />;
            case 'werewolf_kill': return <YouAreDeadOverlay angelInPlay={isAngelInPlay} />;
            case 'troublemaker_duel':
            case 'special':
            case 'lover_death':
            default:
                return <YouAreDeadOverlay angelInPlay={isAngelInPlay} />;
        }
    };
    return (
        <>
            {renderDeathOverlay()}
            <SpectatorGameBoard game={game} players={players} events={events} messages={messages} wolfMessages={wolfMessages} fairyMessages={fairyMessages} twinMessages={twinMessages} loversMessages={loversMessages} ghostMessages={ghostMessages} currentPlayer={currentPlayer} getCauseOfDeath={getCauseOfDeath} timeLeft={timeLeft} />
        </>
    );
  }

  return (
    <SpectatorGameBoard game={game} players={players} events={events} messages={messages} wolfMessages={wolfMessages} fairyMessages={fairyMessages} twinMessages={twinMessages} loversMessages={loversMessages} ghostMessages={ghostMessages} currentPlayer={currentPlayer} getCauseOfDeath={getCauseOfDeath} timeLeft={timeLeft} />
  );
}


function SpectatorGameBoard({ game, players, events, messages, wolfMessages, fairyMessages, twinMessages, loversMessages, ghostMessages, currentPlayer, getCauseOfDeath, timeLeft }: GameBoardProps & { getCauseOfDeath: (playerId: string) => GameEvent['type'] | 'other', timeLeft: number }) {
  const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
  const loverDeathEvents = events.filter(e => e.type === 'lover_death' && e.round === game.currentRound);
  const voteEvent = events.find(e => e.type === 'vote_result' && e.round === (game.phase === 'day' ? game.currentRound : game.currentRound - 1));
  const behaviorClueEvent = events.find(e => e.type === 'behavior_clue' && e.round === game.currentRound -1);

  const getPhaseTitle = () => {
    if (!game) return '';
    const roundNumber = game.currentRound || 0;

    switch(game.phase) {
        case 'night': return `NOCHE ${roundNumber}`;
        case 'day': return `DÍA ${roundNumber}`;
        case 'role_reveal': return 'REPARTIENDO ROLES';
        case 'finished': return 'PARTIDA TERMINADA';
        case 'hunter_shot': return '¡LA VENGANZA DEL CAZADOR!';
        default: return '';
    }
  }
  
  const getPhaseDescription = () => {
    if(!currentPlayer) return 'Observas desde el más allá...';

     switch(game.phase) {
        case 'night':
             if (!currentPlayer.isAlive) return 'Observas desde el más allá...';
             if (currentPlayer?.usedNightAbility) return 'Has actuado. Espera al amanecer.';
             if (game.exiledPlayerId === currentPlayer?.userId) return <> <UserX className="inline-block h-4 w-4" /> ¡Exiliado! No puedes actuar esta noche. </>;
             if (currentPlayer?.role && ['werewolf', 'wolf_cub', 'seer', 'seer_apprentice', 'doctor', 'hechicera', 'guardian', 'priest', 'vampire', 'cult_leader', 'fisherman', 'shapeshifter', 'virginia_woolf', 'river_siren', 'silencer', 'elder_leader', 'witch', 'banshee', 'lookout', 'seeker_fairy', 'resurrector_angel', 'cupid'].includes(currentPlayer.role)) {
                 return "Es tu turno de actuar.";
             }
             return 'Duermes profundamente...';
        case 'day': return currentPlayer.isAlive ? 'Debate y encuentra a los lobos.' : 'Observas el debate desde el más allá...';
        case 'role_reveal': return 'Tu destino está siendo sellado...';
        default: return 'El pueblo espera...';
    }
  }

  const getPhaseIcon = () => {
      switch(game.phase) {
          case 'night': return <Moon className="h-6 w-6" />;
          case 'day': return <Sun className="h-6 w-6 text-yellow-300" />;
          default: return null;
      }
  }
  
  const isTwin = !!game.twins?.includes(currentPlayer?.userId ?? '');
  const otherTwinId = isTwin ? game.twins!.find(id => id !== currentPlayer!.userId) : null;
  const otherTwin = otherTwinId ? players.find(p => p.userId === otherTwinId) : null;

  const isLover = currentPlayer?.isLover;
  const otherLoverId = isLover && game.lovers ? game.lovers.find(id => id !== currentPlayer!.userId) : null;
  const otherLover = otherLoverId ? players.find(p => p.userId === otherLoverId) : null;
  
  const highlightedPlayers = [];
  if (otherTwin) highlightedPlayers.push({ userId: otherTwin.userId, color: 'rgba(135, 206, 250, 0.7)' });
  if (otherLover) highlightedPlayers.push({ userId: otherLover.userId, color: 'rgba(244, 114, 182, 0.7)' });
  
  const playersWithDeathCause = players.map(p => ({
    ...p,
    causeOfDeath: !p.isAlive ? getCauseOfDeath(p.userId) : undefined,
  }));


  if (game.phase === 'role_reveal') {
     return (
       <div className="flex flex-col items-center justify-center h-screen w-screen">
            <Card className="text-center bg-card/80 animate-in fade-in zoom-in-95">
                <CardHeader>
                    <CardTitle className="font-headline text-3xl">
                    Comenzando...
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg text-muted-foreground">Se están repartiendo los roles. La primera noche caerá pronto.</p>
                     <Loader2 className="h-12 w-12 animate-spin text-primary mt-4" />
                </CardContent>
            </Card>
       </div>
     )
  }

  const isHunterWaitingToShoot = game.phase === 'hunter_shot' && game.pendingHunterShot === currentPlayer?.userId;
   if (isHunterWaitingToShoot && currentPlayer) {
      const hunterAlivePlayers = players.filter(p => p.isAlive && p.userId !== currentPlayer.userId);
      return (
        <HunterShot game={game} currentPlayer={currentPlayer} players={hunterAlivePlayers} />
      );
  }

  const showGhostAction = !!(currentPlayer && currentPlayer.role === 'ghost' && !currentPlayer.isAlive && !currentPlayer.ghostMessageSent);
  const showGhostChat = !!(currentPlayer && !currentPlayer.isAlive);

   return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-4">
       <Card className="text-center bg-card/80 sticky top-4 z-30 shadow-lg">
        <CardHeader className="p-4">
             <div className="flex justify-between items-start">
                 <GameChronicle events={events} currentPlayerId={currentPlayer?.userId || ''} />
                <div className="flex-1 text-center">
                    <CardTitle className="font-headline text-3xl flex items-center justify-center gap-3">
                      {getPhaseIcon()}
                      {getPhaseTitle()}
                    </CardTitle>
                    <CardDescription className="text-base mt-1">{getPhaseDescription()}</CardDescription>
                </div>
                <div className="w-12 h-12"></div>
             </div>
             { (game.phase === 'day' || game.phase === 'night') && game.status === 'in_progress' && (
                <PhaseTimer 
                    key={`${game.id}-${game.phase}-${game.currentRound}`}
                    timeLeft={timeLeft}
                />
            )}
        </CardHeader>
      </Card>
      
      {currentPlayer && <PlayerGrid players={playersWithDeathCause} currentPlayer={currentPlayer} highlightedPlayers={highlightedPlayers} />}

      {isTwin && otherTwin && currentPlayer?.isAlive && (
        <Card className="bg-blue-900/30 border-blue-400/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3 text-blue-300">
              <Users2 className="h-5 w-5" />
              <p>Tu gemelo/a es {otherTwin.isAlive ? otherTwin.displayName : `${otherTwin.displayName} (fallecido)`}. Sois aliados hasta el final.</p>
            </div>
          </CardContent>
        </Card>
      )}

       {!!game.fairiesFound && ['seeker_fairy', 'sleeping_fairy'].includes(currentPlayer?.role || '') && (
            <Card className="bg-fuchsia-900/30 border-fuchsia-400/50">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center gap-3 text-fuchsia-300">
                        <Wand2 className="h-5 w-5" />
                        <p>¡Las hadas se han encontrado! Vuestro poder ha despertado.</p>
                    </div>
                </CardContent>
            </Card>
        )}
      
       {isLover && otherLover && (
            <Card className="bg-pink-900/30 border-pink-400/50">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center gap-3 text-pink-300">
                        <Heart className="h-5 w-5" />
                        <p>Estás enamorado de {otherLover.isAlive ? otherLover.displayName : `${otherLover.displayName} (fallecido)`}. Vuestro objetivo es sobrevivir juntos.</p>
                    </div>
                </CardContent>
            </Card>
        )}

      {currentPlayer && game.phase === 'night' && currentPlayer.isAlive && (
        <NightActions game={game} players={players} currentPlayer={currentPlayer} wolfMessages={wolfMessages} fairyMessages={fairyMessages} />
      )}

      {showGhostAction && currentPlayer && (
        <GhostAction game={game} currentPlayer={currentPlayer} players={players.filter(p => p.isAlive)} />
      )}
      
      {(game.phase === 'day' || showGhostChat) && currentPlayer && (
        <div className="mt-8 w-full flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-4">
                {game.phase === 'day' && (
                    <DayPhase 
                        game={game} 
                        players={players}
                        currentPlayer={currentPlayer}
                        nightEvent={nightEvent}
                        loverDeathEvents={loverDeathEvents}
                        voteEvent={voteEvent}
                        behaviorClueEvent={behaviorClueEvent}
                        chatMessages={messages}
                    />
                )}
                
                {showGhostChat && (
                     <GhostChat gameId={game.id} currentPlayer={currentPlayer} messages={ghostMessages} />
                )}

                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                    {isTwin && <TwinChat gameId={game.id} currentPlayer={currentPlayer} messages={twinMessages} />}
                    {game.fairiesFound && ['seeker_fairy', 'sleeping_fairy'].includes(currentPlayer?.role || '') && <FairyChat gameId={game.id} currentPlayer={currentPlayer} messages={fairyMessages} />}
                    {isLover && <LoversChat gameId={game.id} currentPlayer={currentPlayer} messages={loversMessages} />}
                </div>
            </div>
             <div className="w-full md:w-96">
                <GameChat 
                    gameId={game.id} 
                    currentPlayer={currentPlayer} 
                    messages={messages} 
                    players={players}
                />
            </div>
        </div>
      )}

      { game.phase === 'hunter_shot' && !isHunterWaitingToShoot && (
         <Card className="mt-8 bg-card/80">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">¡Disparo del Cazador!</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Un cazador ha caído y debe elegir su objetivo final. Esperando a que dispare...</p>
            </CardContent>
         </Card>
      )}
       
       {currentPlayer && currentPlayer.isAlive && game.status === 'in_progress' && game.phase !== 'role_reveal' && (
        <CurrentPlayerRole player={currentPlayer} />
       )}
    </div>
  );
}
