
"use client";

import type { Game, Player, GameEvent } from "@/types";
import { RoleReveal } from "./RoleReveal";
import { PlayerGrid } from "./PlayerGrid";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useEffect, useState } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { NightActions } from "./NightActions";
import { processNight, processVotes } from "@/app/actions";
import { runAIActions } from "@/app/ai-actions";
import { DayPhase } from "./DayPhase";
import { GameOver } from "./GameOver";
import { HeartIcon, Moon, Sun, Users2 } from "lucide-react";
import { HunterShot } from "./HunterShot";
import { GameChronicle } from "./GameChronicle";
import { PhaseTimer } from "./PhaseTimer";
import { CurrentPlayerRole } from "./CurrentPlayerRole";
import { GameMusic } from "./GameMusic";

interface GameBoardProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
  events: GameEvent[];
}

export function GameBoard({ game, players, currentPlayer, events }: GameBoardProps) {
  const { firestore } = useFirebase();
  const [showRole, setShowRole] = useState(game.phase === 'role_reveal');

  useEffect(() => {
    if (game.phase === 'role_reveal') {
      setShowRole(true);
    } else {
      setShowRole(false);
    }
  }, [game.phase]);

  // Handle AI actions when phase changes
  useEffect(() => {
    // Only the creator should trigger AI actions to avoid multiple executions
    if (game.creator === currentPlayer.userId) {
      if ((game.phase === 'night' || game.phase === 'day' || game.phase === 'hunter_shot') && game.settings.fillWithAI) {
         runAIActions(game.id, game.phase);
      }
    }
  }, [game.phase, game.id, game.creator, currentPlayer.userId, game.currentRound, game.settings.fillWithAI]);

  const handleAcknowledgeRole = async () => {
    setShowRole(false);
    // Only the creator should trigger the phase change to avoid race conditions
    if (game.phase === 'role_reveal' && game.creator === currentPlayer.userId) {
        // Add a delay to allow all players to see their roles
        setTimeout(async () => {
           if (firestore) {
             await updateDoc(doc(firestore, "games", game.id), { 
                  phase: 'night',
              });
           }
        }, 5000); 
    }
  };
  
   const handleTimerEnd = async () => {
    // Only creator processes the phase end to prevent multiple executions
    if (game.creator !== currentPlayer.userId) return;

    if (game.phase === 'night' && game.status === 'in_progress') {
      await processNight(game.id);
    } else if (game.phase === 'day' && game.status === 'in_progress') {
      await processVotes(game.id);
    }
  };
  
  if (game.status === 'finished') {
    const gameOverEvent = events.find(e => e.type === 'game_over');
    return (
        <>
            <GameMusic game={game} />
            <GameOver event={gameOverEvent} players={players} />
        </>
    );
  }

  const isHunterWaitingToShoot = game.phase === 'hunter_shot' && game.pendingHunterShot === currentPlayer.userId;
  if (isHunterWaitingToShoot) {
      const alivePlayers = players.filter(p => p.isAlive && p.userId !== currentPlayer.userId);
      return (
        <>
            <GameMusic game={game} />
            <HunterShot game={game} currentPlayer={currentPlayer} players={alivePlayers} />
        </>
      );
  }

  if (showRole && currentPlayer.role) {
    return (
        <>
            <GameMusic game={game} />
            <RoleReveal player={currentPlayer} onAcknowledge={handleAcknowledgeRole} />
        </>
    );
  }

  const alivePlayers = players.filter(p => p.isAlive);
  const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
  const loverDeathEvents = events.filter(e => e.type === 'lover_death' && e.round === game.currentRound);
  const voteEvent = events.find(e => e.type === 'vote_result' && e.round === game.currentRound - 1);

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
      if (game.phase === 'night') return 45;
      return 0;
  }

  const isLover = !!game.lovers?.includes(currentPlayer.userId);
  const otherLoverId = isLover ? game.lovers!.find(id => id !== currentPlayer.userId) : null;
  const otherLover = otherLoverId ? players.find(p => p.userId === otherLoverId) : null;
  
  const isTwin = currentPlayer.role === 'twin' && !!game.twins?.includes(currentPlayer.userId);
  const otherTwinId = isTwin ? game.twins!.find(id => id !== currentPlayer.userId) : null;
  const otherTwin = otherTwinId ? players.find(p => p.userId === otherTwinId) : null;

  const highlightedPlayers = [];
  if (otherLover) {
    highlightedPlayers.push({ userId: otherLover.userId, color: 'rgba(255, 105, 180, 0.7)' });
  }
  if (otherTwin) {
    highlightedPlayers.push({ userId: otherTwin.userId, color: 'rgba(135, 206, 250, 0.7)' });
  }


  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
       <GameMusic game={game} />
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
                key={`${game.id}-${game.phase}-${game.currentRound}`}
                duration={getTimerDuration()} 
                onTimerEnd={handleTimerEnd}
            />
          )}
        </CardHeader>
      </Card>
      
      <PlayerGrid players={players} highlightedPlayers={highlightedPlayers} />

      {isLover && otherLover && (
        <Card className="bg-pink-900/30 border-pink-400/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3 text-pink-300">
              <HeartIcon className="h-5 w-5" />
              <p>Estás enamorado de {otherLover.isAlive ? otherLover.displayName : `${otherLover.displayName} (fallecido)`}. Vuestro destino está unido.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isTwin && otherTwin && (
        <Card className="bg-blue-900/30 border-blue-400/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3 text-blue-300">
              <Users2 className="h-5 w-5" />
              <p>Tu gemelo/a es {otherTwin.isAlive ? otherTwin.displayName : `${otherTwin.displayName} (fallecido)`}. Sois aliados hasta el final.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {game.phase === 'night' && currentPlayer.isAlive && (
        <NightActions game={game} players={alivePlayers} currentPlayer={currentPlayer} />
      )}
      
      {game.phase === 'day' && (
        <DayPhase 
            game={game} 
            players={players} // Pass all players to show votes on dead players too
            currentPlayer={currentPlayer}
            nightEvent={nightEvent}
            loverDeathEvents={loverDeathEvents}
            voteEvent={voteEvent}
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
       
       { !currentPlayer.isAlive && !isHunterWaitingToShoot && game.status === 'in_progress' && (
         <Card className="mt-8 bg-card/80">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Has Sido Eliminado</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Tu rol era: <span className="font-bold">{currentPlayer.role}</span>.</p>
                <p className="text-destructive font-bold mt-2">Ahora eres un espectador. No puedes hablar ni votar.</p>
            </CardContent>
         </Card>
       )}
       
       {currentPlayer.isAlive && game.status === 'in_progress' && game.phase !== 'role_reveal' && (
        <CurrentPlayerRole player={currentPlayer} />
       )}
    </div>
  );
}
