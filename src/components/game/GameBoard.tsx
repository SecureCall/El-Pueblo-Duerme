'use client';

import type { Game, Player, GameEvent, ChatMessage } from "@/types";
import { RoleReveal } from "./RoleReveal";
import { PlayerGrid } from "./PlayerGrid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { useEffect, useState, useRef, useCallback } from "react";
import { useFirebase } from "@/firebase";
import { NightActions } from "./NightActions";
import { processJuryVotes, executeMasterAction } from "@/lib/firebase-actions";
import { processNight, processVotes } from "@/lib/game-logic";
import { DayPhase } from "./DayPhase";
import { GameOver } from "./GameOver";
import { Heart, Moon, Sun, Users2, Wand2, Loader2, UserX, Scale } from "lucide-react";
import { HunterShot } from "./HunterShot";
import { GameChronicle } from "./GameChronicle";
import { PhaseTimer } from "./PhaseTimer";
import { CurrentPlayerRole } from "./CurrentPlayerRole";
import { YouAreDeadOverlay } from "./YouAreDeadOverlay";
import { BanishedOverlay } from "./BanishedOverlay";
import { HunterKillOverlay } from "./HunterKillOverlay";
import { GhostAction } from "./GhostAction";
import { GameChat } from "./GameChat";
import { TwinChat } from "./TwinChat";
import { FairyChat } from "./FairyChat";
import { VampireKillOverlay } from "./VampireKillOverlay";
import { LoversChat } from "./LoversChat";
import { getMillis } from "@/lib/utils";
import { GhostSpectatorChat } from "./GhostSpectatorChat";
import { JuryVote } from "./JuryVote";
import { MasterActionBar, type MasterActionState } from "./MasterActionBar";
import { useGameSession } from "@/hooks/use-game-session";
import { useGameState } from "@/hooks/use-game-state";

interface GameBoardProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
  events: GameEvent[];
  messages: ChatMessage[];
  wolfMessages: ChatMessage[];
  fairyMessages: ChatMessage[];
  twinMessages: ChatMessage[];
  loversMessages: ChatMessage[];
  ghostMessages: ChatMessage[];
}

export function GameBoard({ 
    game, 
    players, 
    currentPlayer, 
    events, 
    messages, 
    wolfMessages, 
    fairyMessages, 
    twinMessages, 
    loversMessages, 
    ghostMessages 
}: GameBoardProps) {
  const { firestore } = useFirebase();
  const { updateStats } = useGameSession();
  
  const [showRole, setShowRole] = useState(true);
  const [deathCause, setDeathCause] = useState<GameEvent['type'] | 'other' | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [masterActionState, setMasterActionState] = useState<MasterActionState>({ active: false, actionId: null, sourceId: null });

  const prevGameStatusRef = useRef<Game['status']>();

  // Effect for handling game over state change
  useEffect(() => {
    if (!game || !currentPlayer) return;
    
    if (prevGameStatusRef.current !== 'finished' && game.status === 'finished') {
       const gameOverEvent = events.find(e => e.type === 'game_over');
       if (gameOverEvent?.data?.winners && currentPlayer) {
          const isWinner = gameOverEvent.data.winners.some((p: Player) => p.userId === currentPlayer.userId);
          updateStats(isWinner, currentPlayer, game);
       }
    }
    prevGameStatusRef.current = game.status;
  }, [game?.status, events, currentPlayer, game, updateStats]);


  const handleAcknowledgeRole = useCallback(() => {
    setShowRole(false);
    // After acknowledging, if the user is the creator, they trigger the first night.
    if (game.phase === 'role_reveal' && game.creator === currentPlayer.userId && firestore) {
        // This gives a buffer for all players to see their roles before the night starts
        setTimeout(() => {
            processNight(firestore, game.id);
        }, 1000);
    }
  }, [firestore, game, currentPlayer]);


    const getCauseOfDeath = (playerId: string): GameEvent['type'] | 'other' => {
        const deathEvent = [...events]
            .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt))
            .find(e => {
                const data = e.data || {};
                const killedIds = data.killedPlayerIds || (data.killedPlayerId ? [data.killedPlayerId] : []);
                if (killedIds.includes(playerId)) return true;
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
  
  
  useEffect(() => {
    if (!game?.phaseEndsAt || game.status === 'finished') {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const endTime = getMillis(game.phaseEndsAt);
      const remaining = Math.max(0, endTime - now);
      setTimeLeft(Math.round(remaining / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [game?.phaseEndsAt, game?.id]);
  
  if (!game || !currentPlayer) {
      return null;
  }
  
  if (game.status === 'finished') {
    const gameOverEvent = events.find(e => e.type === 'game_over');
    return <GameOver game={game} event={gameOverEvent} players={players} currentPlayer={currentPlayer} />;
  }

  if (currentPlayer.role && game.phase === 'role_reveal' && showRole) {
      return <RoleReveal player={currentPlayer} onAcknowledge={handleAcknowledgeRole} />;
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
            <SpectatorContent 
                game={game} 
                players={players} 
                events={events} 
                messages={messages} 
                wolfMessages={wolfMessages} 
                fairyMessages={fairyMessages} 
                twinMessages={twinMessages} 
                loversMessages={loversMessages} 
                ghostMessages={ghostMessages} 
                currentPlayer={currentPlayer} 
                getCauseOfDeath={getCauseOfDeath} 
                timeLeft={timeLeft} 
                masterActionState={masterActionState} 
                setMasterActionState={setMasterActionState} 
            />
        </>
    );
  }

  return (
    <SpectatorContent 
        game={game} 
        players={players} 
        events={events} 
        messages={messages} 
        wolfMessages={wolfMessages} 
        fairyMessages={fairyMessages} 
        twinMessages={twinMessages} 
        loversMessages={loversMessages} 
        ghostMessages={ghostMessages} 
        currentPlayer={currentPlayer} 
        getCauseOfDeath={getCauseOfDeath} 
        timeLeft={timeLeft} 
        masterActionState={masterActionState} 
        setMasterActionState={setMasterActionState} 
    />
  );
}


function SpectatorContent({ game, players, events, messages, wolfMessages, fairyMessages, twinMessages, loversMessages, ghostMessages, currentPlayer, getCauseOfDeath, timeLeft, masterActionState, setMasterActionState }: GameBoardProps & { getCauseOfDeath: (playerId: string) => GameEvent['type'] | 'other', timeLeft: number; masterActionState: MasterActionState; setMasterActionState: React.Dispatch<React.SetStateAction<MasterActionState>> }) {
  
  const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
  const loverDeathEvents = events.filter(e => e.type === 'lover_death' && e.round === game.currentRound);
  const voteEvent = events.find(e => e.type === 'vote_result' && e.round === (game.phase === 'day' ? game.currentRound : game.currentRound - 1));
  const behaviorClueEvent = events.find(e => e.type === 'behavior_clue' && e.round === game.currentRound -1);

  const getPhaseTitle = () => {
    const roundNumber = game.currentRound || 0;

    switch(game.phase) {
        case 'night': return `NOCHE ${roundNumber}`;
        case 'day': return `DÍA ${roundNumber}`;
        case 'role_reveal': return 'REPARTIENDO ROLES';
        case 'finished': return 'PARTIDA TERMINADA';
        case 'hunter_shot': return '¡LA VENGANZA DEL CAZADOR!';
        case 'jury_voting': return 'VOTO DEL JURADO';
        default: return '';
    }
  }
  
  const getPhaseDescription = () => {
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
        case 'jury_voting': return !currentPlayer.isAlive ? 'Los vivos esperan tu sentencia.' : 'El jurado de los muertos decide...';
        default: return 'El pueblo espera...';
    }
  }

  const getPhaseIcon = () => {
      switch(game.phase) {
          case 'night': return <Moon className="h-6 w-6" />;
          case 'day': return <Sun className="h-6 w-6 text-yellow-300" />;
          case 'jury_voting': return <Scale className="h-6 w-6 text-yellow-400" />
          default: return null;
      }
  }
  
  const isTwin = !!game.twins?.includes(currentPlayer.userId);
  const otherTwinId = isTwin ? game.twins!.find(id => id !== currentPlayer.userId) : null;
  const otherTwin = otherTwinId ? players.find(p => p.userId === otherTwinId) : null;

  const isLover = currentPlayer.isLover;
  const otherLoverId = isLover && game.lovers ? game.lovers.find(id => id !== currentPlayer.userId) : null;
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

  const isHunterWaitingToShoot = game.phase === 'hunter_shot' && game.pendingHunterShot === currentPlayer.userId;
   if (isHunterWaitingToShoot) {
      const hunterAlivePlayers = players.filter(p => p.isAlive && p.userId !== currentPlayer.userId);
      return (
        <HunterShot game={game} currentPlayer={currentPlayer} players={hunterAlivePlayers} />
      );
  }

  const showGhostAction = !!(currentPlayer.role === 'ghost' && !currentPlayer.isAlive && !currentPlayer.ghostMessageSent);
  const showGhostChat = !currentPlayer.isAlive;
  const showJuryVote = game.phase === 'jury_voting' && !currentPlayer.isAlive && game.settings.juryVoting;
  const isMaster = game.creator === currentPlayer.userId;

   return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-4">
       <Card className="text-center bg-card/80 sticky top-4 z-30 shadow-lg">
        <CardHeader className="p-4">
             <div className="flex justify-between items-start">
                 <GameChronicle events={events} currentPlayerId={currentPlayer.userId} />
                <div className="flex-1 text-center">
                    <CardTitle className="font-headline text-3xl flex items-center justify-center gap-3">
                      {getPhaseIcon()}
                      {getPhaseTitle()}
                    </CardTitle>
                    <CardDescription className="text-base mt-1">{getPhaseDescription()}</CardDescription>
                </div>
                 <div className="w-12 h-12 flex items-center justify-center">
                    {isMaster && <MasterActionBar game={game} setMasterActionState={setMasterActionState} />}
                </div>
             </div>
             { (game.phase === 'day' || game.phase === 'night' || game.phase === 'jury_voting') && game.status === 'in_progress' && (
                <PhaseTimer 
                    key={`${game.id}-${game.phase}-${game.currentRound}`}
                    timeLeft={timeLeft}
                />
            )}
        </CardHeader>
      </Card>
      
      <PlayerGrid game={game} players={playersWithDeathCause} currentPlayer={currentPlayer} highlightedPlayers={highlightedPlayers} masterActionState={masterActionState} setMasterActionState={setMasterActionState} />

      {isTwin && otherTwin && currentPlayer.isAlive && (
        <Card className="bg-blue-900/30 border-blue-400/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3 text-blue-300">
              <Users2 className="h-5 w-5" />
              <p>Tu gemelo/a es {otherTwin.isAlive ? otherTwin.displayName : `${otherTwin.displayName} (fallecido)`}. Sois aliados hasta el final.</p>
            </div>
          </CardContent>
        </Card>
      )}

       {!!game.fairiesFound && ['seeker_fairy', 'sleeping_fairy'].includes(currentPlayer.role || '') && (
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

      {game.phase === 'night' && currentPlayer.isAlive && (
        <NightActions game={game} players={players} currentPlayer={currentPlayer} wolfMessages={wolfMessages} fairyMessages={fairyMessages} />
      )}

      {showGhostAction && (
        <GhostAction game={game} currentPlayer={currentPlayer} players={players.filter(p => p.isAlive)} />
      )}
      
      {(game.phase === 'day' || showGhostChat || game.phase === 'jury_voting') && (
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
                    />
                )}
                
                {showJuryVote && voteEvent?.data?.tiedPlayerIds && (
                    <JuryVote game={game} players={players} currentPlayer={currentPlayer} tiedPlayerIds={voteEvent.data.tiedPlayerIds} />
                )}

                {showGhostChat && ghostMessages && (
                     <GhostSpectatorChat gameId={game.id} currentPlayer={currentPlayer} messages={ghostMessages} />
                )}

                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                    {isTwin && <TwinChat gameId={game.id} currentPlayer={currentPlayer} messages={twinMessages} />}
                    {game.fairiesFound && ['seeker_fairy', 'sleeping_fairy'].includes(currentPlayer.role || '') && <FairyChat gameId={game.id} currentPlayer={currentPlayer} messages={fairyMessages} />}
                    {isLover && <LoversChat gameId={game.id} currentPlayer={currentPlayer} messages={loversMessages} />}
                </div>
            </div>
             <div className="w-full md:w-96">
                <GameChat 
                    game={game}
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
       
       {currentPlayer.isAlive && game.status === 'in_progress' && game.phase !== 'role_reveal' && (
        <CurrentPlayerRole player={currentPlayer} />
       )}
    </div>
  );
}
