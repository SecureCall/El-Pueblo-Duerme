"use client";

import type { Game, Player, GameEvent } from "@/types";
import { RoleReveal } from "./RoleReveal";
import { PlayerGrid } from "./PlayerGrid";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useEffect, useState, useMemo } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { NightActions } from "./NightActions";
import { processNight } from "@/app/actions";
import { DayPhase } from "./DayPhase";
import { GameOver } from "./GameOver";
import { HeartIcon } from "lucide-react";
import { HunterShot } from "./HunterShot";
import { GameChronicle } from "./GameChronicle";
import { PhaseTimer } from "./PhaseTimer";

interface GameBoardProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
  events: GameEvent[];
}

export function GameBoard({ game, players, currentPlayer, events }: GameBoardProps) {
  const [showRole, setShowRole] = useState(game.phase === 'role_reveal');

  useEffect(() => {
    if (game.phase === 'role_reveal') {
      setShowRole(true);
    } else {
      setShowRole(false);
    }
  }, [game.phase]);

  const handleAcknowledgeRole = async () => {
    setShowRole(false);
    if (game.phase === 'role_reveal' && game.creator === currentPlayer.userId) {
        setTimeout(async () => {
           await updateDoc(doc(db, "games", game.id), { 
                phase: 'night',
            });
        }, 3000);
    }
  };
  
   const handleTimerEnd = async () => {
    if (game.phase === 'night' && game.creator === currentPlayer.userId && game.status === 'in_progress') {
      await processNight(game.id);
    }
  };
  
  if (game.status === 'finished') {
    const gameOverEvent = events.find(e => e.type === 'game_over');
    return <GameOver event={gameOverEvent} players={players} />;
  }

  if (game.phase === 'hunter_shot' && game.pendingHunterShot === currentPlayer.userId) {
      const alivePlayers = players.filter(p => p.isAlive && p.userId !== currentPlayer.userId);
      return <HunterShot game={game} currentPlayer={currentPlayer} players={alivePlayers} />;
  }

  if (showRole && currentPlayer.role) {
    return <RoleReveal player={currentPlayer} onAcknowledge={handleAcknowledgeRole} />;
  }

  const alivePlayers = players.filter(p => p.isAlive);
  const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound);
  const loverDeathEvents = events.filter(e => e.type === 'lover_death' && e.round === game.currentRound);

  const getPhaseTitle = () => {
    switch(game.phase) {
        case 'night': return `Noche ${game.currentRound}`;
        case 'day': return `Día ${game.currentRound}`;
        case 'voting': return `Votación Día ${game.currentRound}`;
        case 'role_reveal': return 'Comenzando...';
        case 'finished': return 'Partida Terminada';
        case 'hunter_shot': return '¡La venganza del Cazador!';
        default: return '';
    }
  }

  const isLover = !!game.lovers?.includes(currentPlayer.userId);
  const otherLoverId = isLover ? game.lovers!.find(id => id !== currentPlayer.userId) : null;
  const otherLover = otherLoverId ? players.find(p => p.userId === otherLoverId) : null;
  const highlightedPlayers = otherLover ? [{ userId: otherLover.userId, color: 'rgba(255, 105, 180, 0.7)' }] : [];


  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
       <Card className="text-center bg-card/80">
        <CardHeader className="flex flex-row items-center justify-between p-4 relative">
          <div className="flex-1">
            <CardTitle className="font-headline text-3xl">
              {getPhaseTitle()}
            </CardTitle>
          </div>
          {game.phase === 'night' && game.status === 'in_progress' && (
            <PhaseTimer duration={30} onTimerEnd={handleTimerEnd} />
          )}
          <GameChronicle events={events} />
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

      {game.phase === 'night' && currentPlayer.isAlive && (
        <NightActions game={game} players={alivePlayers} currentPlayer={currentPlayer} />
      )}
      
      {game.phase === 'day' && currentPlayer.isAlive && (
        <DayPhase 
            game={game} 
            players={alivePlayers} 
            currentPlayer={currentPlayer}
            nightEvent={nightEvent}
            loverDeathEvents={loverDeathEvents}
        />
      )}
       
       { !currentPlayer.isAlive && game.status === 'in_progress' && (
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
    </div>
  );
}
