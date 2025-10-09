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
    if (game.phase === 'night' && game.creator === currentPlayer.userId) {
        // Give players 30 seconds to perform their actions
        timer = setTimeout(async () => {
            await processNight(game.id);
        }, 30000); // 30 seconds
    }
    return () => clearTimeout(timer);
  }, [game.phase, game.id, game.currentRound, game.creator, currentPlayer.userId]);

  if (showRole && currentPlayer.role) {
    return <RoleReveal player={currentPlayer} onAcknowledge={handleAcknowledgeRole} />;
  }

  const alivePlayers = players.filter(p => p.isAlive);
  const nightEvent = events.find(e => e.type === 'night_result' && e.round === game.currentRound - 1);
  const voteEvent = events.find(e => e.type === 'vote_result' && e.round === game.currentRound -1);

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

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      <Card className="text-center bg-card/80">
        <CardHeader>
          <CardTitle className="font-headline text-3xl">
            {getPhaseTitle()}
          </CardTitle>
        </CardHeader>
      </Card>
      
      <PlayerGrid players={players} />

      {game.phase === 'night' && currentPlayer.isAlive && (
        <NightActions game={game} players={alivePlayers} currentPlayer={currentPlayer} />
      )}
      
      {game.phase === 'day' && currentPlayer.isAlive && (
        <DayPhase 
            game={game} 
            players={alivePlayers} 
            currentPlayer={currentPlayer}
            nightEvent={nightEvent}
        />
      )}
       
       {game.phase !== 'night' && game.phase !== 'role_reveal' && (
         <Card className="mt-8 bg-card/80">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Tu Rol</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Eres un <span className="font-bold">{currentPlayer.role}</span>.</p>
                 {!currentPlayer.isAlive && <p className="text-destructive font-bold mt-2">Has sido eliminado.</p>}
            </CardContent>
         </Card>
       )}
    </div>
  );
}
