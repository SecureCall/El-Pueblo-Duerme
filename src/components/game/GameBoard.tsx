
'use client';

import type { Game, Player, GameEvent, ChatMessage } from "@/types";
import { RoleReveal } from "./RoleReveal";
import { PlayerGrid } from "./PlayerGrid";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useEffect, useState, useRef } from "react";
import { useFirebase } from "@/firebase";
import { NightActions } from "./NightActions";
import { processNight, processVotes, setPhaseToNight } from "@/lib/firebase-actions";
import { DayPhase } from "./DayPhase";
import { GameOver } from "./GameOver";
import { Heart, Moon, Sun, Users2, Wand2 } from "lucide-react";
import { HunterShot } from "./HunterShot";
import { GameChronicle } from "./GameChronicle";
import { PhaseTimer } from "./PhaseTimer";
import { CurrentPlayerRole } from "./CurrentPlayerRole";
import { playNarration } from "@/lib/sounds";
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

const PHASE_DURATION_SECONDS = 45;

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
    loversMessages: initialLoversMessages
}: GameBoardProps) {
  const { firestore } = useFirebase();
  const { game, players, currentPlayer, events, messages, wolfMessages, fairyMessages, twinMessages, loversMessages } = useGameState(initialGame.id, {
    initialGame,
    initialPlayers,
    initialCurrentPlayer,
    initialEvents,
    initialMessages,
    initialWolfMessages,
    initialFairyMessages,
    initialTwinMessages,
    initialLoversMessages,
  });
  
  const prevPhaseRef = useRef<Game['phase']>();
  const [showRole, setShowRole] = useState(true);
  const [deathCause, setDeathCause] = useState<GameEvent['type'] | 'other' | null>(null);
  const nightSoundsPlayedForRound = useRef<number>(0);

  // Sound effect logic
  useEffect(() => {
    if (!game) return;
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
          break;
        case 'day':
          playNarration('dia_pueblo_despierta.mp3');
          setTimeout(() => playNarration('inicio_debate.mp3'), 2000);
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

  }, [game?.phase, game?.currentRound, events, players]);

    const getCauseOfDeath = (playerId: string): GameEvent['type'] | 'other' => {
        const deathEvent = [...events]
            .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
            .find(e => {
                if (e.data?.killedPlayerId === playerId) return true;
                if (Array.isArray(e.data?.killedPlayerIds) && e.data.killedPlayerIds.includes(playerId)) return true;
                if (e.data?.lynchedPlayerId === playerId) return true;
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
  
  // Effect for creator to automatically advance from role_reveal
  useEffect(() => {
    if (!game || !currentPlayer) return;
    if (game.phase === 'role_reveal' && game.creator === currentPlayer.userId && firestore) {
      const timer = setTimeout(() => {
        setPhaseToNight(firestore, game.id);
      }, 15000); 

      return () => clearTimeout(timer);
    }
  }, [game?.phase, game?.id, game?.creator, currentPlayer?.userId, firestore]);
  
   const handlePhaseEnd = async () => {
    if (!firestore || !game || game.status !== 'in_progress') return; 
    
    // Any active client can trigger the phase end.
    // The backend functions (processVotes/processNight) MUST be idempotent.
    if (game.phase === 'day') {
        await processVotes(firestore, game.id);
    } else if (game.phase === 'night') {
        await processNight(firestore, game.id);
    }
  };

  useEffect(() => {
      if (!game || !game.phaseEndsAt || game.status !== 'in_progress' || (game.phase !== 'day' && game.phase !== 'night')) {
          return;
      }
      
      const endTime = game.phaseEndsAt.toMillis();
      const now = Date.now();
      
      if (now >= endTime) {
          handlePhaseEnd();
          return;
      }

      const timeout = setTimeout(() => {
          handlePhaseEnd();
      }, endTime - now);

      return () => clearTimeout(timeout);
  }, [game?.phaseEndsAt, game?.id, game?.phase]);


  if (!game || !currentPlayer) {
      return null;
  }
  
  if (game.status === 'finished') {
    const gameOverEvent = events.find(e => e.type === 'game_over');
    return (
        <GameOver game={game} event={gameOverEvent} players={players} />
    );
  }

  if (currentPlayer && currentPlayer.role && game.phase === 'role_reveal' && showRole) {
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
            <SpectatorGameBoard game={game} players={players} events={events} messages={messages} wolfMessages={wolfMessages} fairyMessages={fairyMessages} twinMessages={twinMessages} loversMessages={loversMessages} currentPlayer={currentPlayer} getCauseOfDeath={getCauseOfDeath} />
        </>
    );
  }

  return (
    <SpectatorGameBoard game={game} players={players} events={events} messages={messages} wolfMessages={wolfMessages} fairyMessages={fairyMessages} twinMessages={twinMessages} loversMessages={loversMessages} currentPlayer={currentPlayer} getCauseOfDeath={getCauseOfDeath} />
  );
}


function SpectatorGameBoard({ game, players, events, messages, wolfMessages, fairyMessages, twinMessages, loversMessages, currentPlayer, getCauseOfDeath }: GameBoardProps & { getCauseOfDeath: (playerId: string) => GameEvent['type'] | 'other' }) {
  const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
  const loverDeathEvents = events.filter(e => e.type === 'lover_death' && e.round === game.currentRound);
  const voteEvent = events.find(e => e.type === 'vote_result' && e.round === game.currentRound - 1);
  const behaviorClueEvent = events.find(e => e.type === 'behavior_clue' && e.round === game.currentRound -1);

  const getPhaseTitle = () => {
    switch(game.phase) {
        case 'night': return `Noche ${game.currentRound}`;
        case 'day': return `Día ${game.currentRound}`;
        case 'role_reveal': return 'Comenzando...';
        case 'finished': return 'Partida Terminada';
        case 'hunter_shot': return '¡La venganza del Cazador!';
        default: return '';
    }
  }

  const getPhaseIcon = () => {
      switch(game.phase) {
          case 'night': return <Moon className="h-8 w-8" />;
          case 'day': return <Sun className="h-8 w-8 text-yellow-300" />;
          default: return null;
      }
  }
  
  const isTwin = currentPlayer?.role === 'twin' && !!game.twins?.includes(currentPlayer.userId);
  const otherTwinId = isTwin ? game.twins!.find(id => id !== currentPlayer!.userId) : null;
  const otherTwin = otherTwinId ? players.find(p => p.userId === otherTwinId) : null;

  const isFairy = ['seeker_fairy', 'sleeping_fairy'].includes(currentPlayer?.role || '');
  const isLover = !!currentPlayer?.isLover;
  const otherLover = isLover ? players.find(p => p.isLover && p.userId !== currentPlayer.userId) : null;


  const highlightedPlayers = [];
  if (otherTwin) highlightedPlayers.push({ userId: otherTwin.userId, color: 'rgba(135, 206, 250, 0.7)' });
  if (otherLover) highlightedPlayers.push({ userId: otherLover.userId, color: 'rgba(244, 114, 182, 0.7)' });
  
  const playersWithDeathCause = players.map(p => ({
    ...p,
    causeOfDeath: !p.isAlive ? getCauseOfDeath(p.userId) : undefined,
  }));


  if (game.phase === 'role_reveal') {
     return (
       <Card className="text-center bg-card/80">
          <CardHeader>
            <CardTitle className="font-headline text-3xl">
              Comenzando...
            </CardTitle>
          </CardHeader>
           <CardContent>
               <p className="text-lg text-muted-foreground">Se están repartiendo los roles. La primera noche caerá pronto.</p>
           </CardContent>
       </Card>
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


   return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
       <Card className="text-center bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between p-4 pb-8 relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
             <GameChronicle events={events} currentPlayerId={currentPlayer?.userId || ''} />
          </div>
          <div className="flex-1 flex justify-center items-center gap-4">
             {getPhaseIcon()}
            <CardTitle className="font-headline text-3xl">
              {getPhaseTitle()}
            </CardTitle>
          </div>
           { (game.phase === 'day' || game.phase === 'night') && game.status === 'in_progress' && (
            <PhaseTimer 
                phaseEndsAt={game.phaseEndsAt}
                phaseDuration={PHASE_DURATION_SECONDS}
            />
          )}
        </CardHeader>
      </Card>
      
      <PlayerGrid players={playersWithDeathCause} highlightedPlayers={highlightedPlayers} />

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

       {isFairy && game.fairiesFound && (
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
      
      {game.phase === 'day' && currentPlayer && (
        <div className="mt-8 w-full flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-4">
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
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                    {isTwin && <TwinChat gameId={game.id} currentPlayer={currentPlayer} messages={twinMessages} />}
                    {game.fairiesFound && isFairy && <FairyChat gameId={game.id} currentPlayer={currentPlayer} messages={fairyMessages} />}
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
