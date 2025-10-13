
"use client";

import type { Game, Player, GameEvent, ChatMessage } from "@/types";
import { RoleReveal } from "./RoleReveal";
import { PlayerGrid } from "./PlayerGrid";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useEffect, useState, useRef } from "react";
import { doc, runTransaction } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { NightActions } from "./NightActions";
import { processNight, processVotes, runAIActions, advanceToNightPhase, acknowledgeRole } from "@/lib/firebase-actions";
import { DayPhase } from "./DayPhase";
import { GameOver } from "./GameOver";
import { HeartIcon, Moon, Sun, Users2, Gavel, Skull } from "lucide-react";
import { HunterShot } from "./HunterShot";
import { GameChronicle } from "./GameChronicle";
import { PhaseTimer } from "./PhaseTimer";
import { CurrentPlayerRole } from "./CurrentPlayerRole";
import { playNarration, playSoundEffect } from "@/lib/sounds";
import { YouAreDeadOverlay } from "./YouAreDeadOverlay";
import Image from 'next/image';

interface GameBoardProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
  events: GameEvent[];
  messages: ChatMessage[];
}

export function GameBoard({ game, players, currentPlayer, events, messages }: GameBoardProps) {
  const { firestore } = useFirebase();
  const prevPhaseRef = useRef<Game['phase']>();
  const prevRoundRef = useRef<number>();
  const nightSoundsPlayedForRound = useRef<number>(0);
  const [showRole, setShowRole] = useState(true);

  // Sound effect logic
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;

    // Phase change narrations
    if (prevPhase !== game.phase) {
      switch (game.phase) {
        case 'night':
          if (game.currentRound === 1 && prevPhase === 'role_reveal') {
            playNarration('intro_epica.mp3').then(() => {
              setTimeout(() => playNarration('noche_pueblo_duerme.mp3'), 1000);
            });
          } else {
            playNarration('noche_pueblo_duerme.mp3');
          }
          break;
        case 'day':
          playNarration('dia_pueblo_despierta.mp3').then(() => {
            playNarration('inicio_debate.mp3');
          });
          break;
        case 'voting':
           playNarration('inicio_votacion.mp3');
           break;
      }
    }

    // Lynch result announcement
    if (game.phase === 'day' && game.currentRound !== prevRoundRef.current && game.currentRound > 1) {
        const voteEvent = events.find(e => e.type === 'vote_result' && e.round === game.currentRound - 1);
        if (voteEvent) {
             setTimeout(() => {
                if (voteEvent.data?.lynchedPlayerId) {
                     playSoundEffect('anuncio_exilio.mp3');
                }
            }, 3000); // Delay to not overlap with other sounds
        }
    }
    
    prevPhaseRef.current = game.phase;
    prevRoundRef.current = game.currentRound;

  }, [game.phase, game.currentRound, events, currentPlayer.userId]);

  // Specific useEffect for night result sounds based on new events
  useEffect(() => {
    const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
    if (nightEvent && nightSoundsPlayedForRound.current !== game.currentRound) {
        const hasDeaths = nightEvent.data?.killedPlayerIds?.length > 0;
        if (hasDeaths) {
            playSoundEffect('descanse_en_paz.mp3');
        } else {
            const wasSaved = nightEvent.data?.savedPlayerIds?.length > 0;
            const wasAttack = game.nightActions?.some(a => a.round === game.currentRound && a.actionType === 'werewolf_kill');
            if(wasSaved && wasAttack) {
              playSoundEffect('milagro.mp3');
            }
        }
        nightSoundsPlayedForRound.current = game.currentRound; // Mark as played for this round
    }
}, [events, game.currentRound, game.nightActions]);


  // Handle AI actions when phase changes
  useEffect(() => {
    // Only the creator should trigger AI actions to avoid multiple executions
    if (game.creator === currentPlayer.userId && firestore) {
      if ((game.phase === 'night' || game.phase === 'day' || game.phase === 'hunter_shot') && game.settings.fillWithAI) {
         runAIActions(firestore, game.id, game.phase);
      }
    }
  }, [game.phase, game.id, game.creator, currentPlayer.userId, game.currentRound, game.settings.fillWithAI, firestore]);
  
  // Effect for creator to automatically advance from role_reveal
  useEffect(() => {
    if (game.phase === 'role_reveal' && game.creator === currentPlayer.userId && firestore) {
      const timer = setTimeout(() => {
        advanceToNightPhase(firestore, game.id);
      }, 15000); // 15 seconds to view role

      return () => clearTimeout(timer);
    }
  }, [game.phase, game.id, game.creator, currentPlayer.userId, firestore]);
  
   const handleTimerEnd = async () => {
    // Only creator processes the phase end to prevent multiple executions
    if (game.creator !== currentPlayer.userId || !firestore) return;

    if (game.phase === 'night' && game.status === 'in_progress') {
      await processNight(firestore, game.id);
    } else if (game.phase === 'day' && game.status === 'in_progress') {
      await processVotes(firestore, game.id);
    }
  };

  const handleAcknowledgeRole = async () => {
      if (!firestore) return;
      setShowRole(false);
  };
  
  if (game.status === 'finished') {
    const gameOverEvent = events.find(e => e.type === 'game_over');
    return (
        <GameOver game={game} event={gameOverEvent} players={players} />
    );
  }

  // Show the "You are dead" overlay if the current player is not alive
  // and the game is still in progress.
  if (!currentPlayer.isAlive && game.status === 'in_progress') {
    return (
        <>
            <YouAreDeadOverlay />
            {/* Render the game board in the background for spectating */}
            <div className="w-full max-w-7xl mx-auto p-4 space-y-6 opacity-50 pointer-events-none">
                <SpectatorGameBoard game={game} players={players} events={events} messages={messages} currentPlayer={currentPlayer} />
            </div>
        </>
    );
  }

  if (currentPlayer && currentPlayer.role && game.phase === 'role_reveal' && showRole) {
      return <RoleReveal player={currentPlayer} onAcknowledge={handleAcknowledgeRole} />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
       <SpectatorGameBoard game={game} players={players} events={events} messages={messages} currentPlayer={currentPlayer} />
    </div>
  );
}


// A simplified version of the board for spectating, without interactive elements.
function SpectatorGameBoard({ game, players, events, messages, currentPlayer }: Omit<GameBoardProps, 'currentPlayer' | 'messages'> & { currentPlayer?: Player, messages: ChatMessage[] }) {
  const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
  const loverDeathEvents = events.filter(e => e.type === 'lover_death' && e.round === game.currentRound);
  const voteEvent = events.find(e => e.type === 'vote_result' && e.round === game.currentRound - 1);
  const behaviorClueEvent = events.find(e => e.type === 'behavior_clue' && e.round === game.currentRound -1);
  const { firestore } = useFirebase();

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
  
  const getTimerDuration = () => {
      if (game.phase === 'day') return 90;
      if (game.phase === 'night') return 60;
      return 0;
  }
  
  const isLover = !!game.lovers?.includes(currentPlayer?.userId || '');
  const otherLoverId = isLover ? game.lovers!.find(id => id !== currentPlayer!.userId) : null;
  const otherLover = otherLoverId ? players.find(p => p.userId === otherLoverId) : null;
  
  const isTwin = currentPlayer?.role === 'twin' && !!game.twins?.includes(currentPlayer.userId);
  const otherTwinId = isTwin ? game.twins!.find(id => id !== currentPlayer!.userId) : null;
  const otherTwin = otherTwinId ? players.find(p => p.userId === otherTwinId) : null;

  const highlightedPlayers = [];
  if (otherLover) {
    highlightedPlayers.push({ userId: otherLover.userId, color: 'rgba(255, 105, 180, 0.7)' });
  }
  if (otherTwin) {
    highlightedPlayers.push({ userId: otherTwin.userId, color: 'rgba(135, 206, 250, 0.7)' });
  }

  const getCauseOfDeath = (playerId: string): 'werewolf_kill' | 'vote_result' | 'other' => {
      // Find the most recent event related to this player's death
      const deathEvent = events
          .filter(e =>
              (e.type === 'night_result' && (e.data?.killedPlayerIds?.includes(playerId) || e.data?.killedByPoisonId === playerId)) ||
              (e.type === 'vote_result' && e.data?.lynchedPlayerId === playerId) ||
              ((e.type === 'lover_death' || e.type === 'hunter_shot') && e.data?.killedPlayerId === playerId)
          )
          .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0];

      if (deathEvent) {
          if (deathEvent.type === 'night_result') return 'werewolf_kill';
          if (deathEvent.type === 'vote_result') return 'vote_result';
      }
      return 'other';
  };
  
  const playersWithDeathCause = players.map(p => ({
    ...p,
    causeOfDeath: !p.isAlive ? getCauseOfDeath(p.userId) : undefined,
  }));


  const handleTimerEnd = async () => {
     // Only creator processes the phase end to prevent multiple executions
    if (!currentPlayer || game.creator !== currentPlayer.userId || !firestore) return;

    if (game.phase === 'night' && game.status === 'in_progress') {
      await processNight(firestore, game.id);
    } else if (game.phase === 'day' && game.status === 'in_progress') {
      await processVotes(firestore, game.id);
    }
  };

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


   return (
    <>
       <Card className="text-center bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between p-4 pb-8 relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
             <GameChronicle events={events} />
          </div>
          <div className="flex-1 flex justify-center items-center gap-4">
             {getPhaseIcon()}
            <CardTitle className="font-headline text-3xl">
              {getPhaseTitle()}
            </CardTitle>
          </div>
           { (game.phase === 'night' || game.phase === 'day') && game.status === 'in_progress' && (
            <PhaseTimer 
                timerKey={`${game.id}-${game.phase}-${game.currentRound}`}
                duration={getTimerDuration()} 
                onTimerEnd={handleTimerEnd}
            />
          )}
        </CardHeader>
      </Card>
      
      <PlayerGrid players={playersWithDeathCause} highlightedPlayers={highlightedPlayers} />

       {isLover && otherLover && currentPlayer?.isAlive && (
        <Card className="bg-pink-900/30 border-pink-400/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3 text-pink-300">
              <HeartIcon className="h-5 w-5" />
              <p>Estás enamorado de {otherLover.isAlive ? otherLover.displayName : `${otherLover.displayName} (fallecido)`}. Vuestro destino está unido.</p>
            </div>
          </CardContent>
        </Card>
      )}

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

      {currentPlayer && game.phase === 'night' && currentPlayer.isAlive && (
        <NightActions game={game} players={players.filter(p=>p.isAlive)} currentPlayer={currentPlayer} />
      )}
      
      {currentPlayer && game.phase === 'day' && (
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
    </>
  );
}
