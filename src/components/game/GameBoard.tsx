"use client";

import type { Game, Player, GameEvent } from "@/types";
import { RoleReveal } from "./RoleReveal";
import { PlayerGrid } from "./PlayerGrid";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useEffect, useState } from "react";
import { updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { NightActions } from "./NightActions";
import { processNight } from "@/app/actions";
import { DayPhase } from "./DayPhase";
import { GameOver } from "./GameOver";
import { HeartIcon } from "lucide-react";

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
        // Simple mechanism to give players time to see their roles.
        // In a real app, this should be a server-side check.
        setTimeout(async () => {
           await updateDoc(doc(db, "games", game.id), { 
                phase: 'night',
            });
        }, 3000);
    }
  };
  
   useEffect(() => {
    let timer: NodeJS.Timeout;
    if (game.phase === 'night' && game.creator === currentPlayer.userId && game.status === 'in_progress') {
        // Give players 30 seconds to perform their actions
        timer = setTimeout(async () => {
            await processNight(game.id);
        }, 30000); // 30 seconds
    }
    return () => clearTimeout(timer);
  }, [game.phase, game.id, game.currentRound, game.creator, currentPlayer.userId, game.status]);
  
  if (game.status === 'finished') {
    const gameOverEvent = events.find(e => e.type === 'game_over');
    return <GameOver event={gameOverEvent} players={players} />;
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
        default: return '';
    }
  }

  const isLover = !!game.lovers?.includes(currentPlayer.userId);
  const otherLoverId = isLover ? game.lovers!.find(id => id !== currentPlayer.userId) : null;
  const otherLover = otherLoverId ? players.find(p => p.userId === otherLoverId) : null;
  const highlightedPlayers = otherLover ? [{ userId: otherLover.userId, color: '#FF69B4' }] : [];


  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      <Card className="text-center bg-card/80">
        <CardHeader>
          <CardTitle className="font-headline text-3xl">
            {getPhaseTitle()}
          </CardTitle>
        </CardHeader>
      </Card>
      
      <PlayerGrid players={players} highlightedPlayers={highlightedPlayers} />

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
       
       {game.phase !== 'night' && game.phase !== 'role_reveal' && (
         <Card className="mt-8 bg-card/80">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Tu Estatus</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Eres un <span className="font-bold">{currentPlayer.role}</span>.</p>
                {isLover && otherLover && (
                  <div className="flex items-center gap-2 mt-2 text-pink-400">
                    <HeartIcon className="h-5 w-5" />
                    <p>Estás enamorado de {otherLover.isAlive ? otherLover.displayName : `${otherLover.displayName} (fallecido)`}.</p>
                  </div>
                )}
                 {!currentPlayer.isAlive && <p className="text-destructive font-bold mt-2">Has sido eliminado.</p>}
            </CardContent>
         </Card>
       )}
    </div>
  );
}
