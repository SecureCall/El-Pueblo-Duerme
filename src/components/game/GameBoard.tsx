"use client";

import type { Game, Player } from "@/types";
import { RoleReveal } from "./RoleReveal";
import { PlayerGrid } from "./PlayerGrid";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useEffect, useState } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { NightActions } from "./NightActions";
import { processNight } from "@/app/actions";

interface GameBoardProps {
  game: Game;
  players: Player[];
  currentPlayer: Player;
}

export function GameBoard({ game, players, currentPlayer }: GameBoardProps) {
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
        // Transition to the first night
        // A more robust solution would use a timer or check all players have acknowledged
        const phaseDuration = 60; // 60 seconds for the night phase
        const endsAt = new Date();
        endsAt.setSeconds(endsAt.getSeconds() + phaseDuration);

        await updateDoc(doc(db, "games", game.id), { 
          phase: 'night',
          phaseEndsAt: Timestamp.fromDate(endsAt),
        });
    }
  };
  
  // A simple timer to transition from night to day
  // In a real app, this should be a reliable cron job / cloud function.
   useEffect(() => {
    let timer: NodeJS.Timeout;
    if (game.phase === 'night' && game.phaseEndsAt && game.creator === currentPlayer.userId) {
      const now = new Date().getTime();
      const endTime = game.phaseEndsAt.toMillis();
      const delay = Math.max(0, endTime - now);

      timer = setTimeout(async () => {
        // Here we would process all night actions
        await processNight(game.id);
      }, delay);
    }
    return () => clearTimeout(timer);
  }, [game.phase, game.phaseEndsAt, game.id, game.creator, currentPlayer.userId]);

  if (showRole && currentPlayer.role) {
    return <RoleReveal player={currentPlayer} onAcknowledge={handleAcknowledgeRole} />;
  }

  const alivePlayers = players.filter(p => p.isAlive);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-8">
      <Card className="text-center bg-card/80">
        <CardHeader>
          <CardTitle className="font-headline text-3xl">
            {game.phase === 'night' && `Noche ${game.currentRound}`}
            {game.phase === 'day' && `Día ${game.currentRound}`}
            {game.phase === 'voting' && `Votación`}
             {game.phase === 'role_reveal' && `Comenzando...`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
             {game.phase === 'night' && 'La noche cae sobre el pueblo. Silencio...'}
             {game.phase === 'day' && 'El sol sale. El pueblo se reúne para decidir.'}
             {game.phase === 'voting' && 'Es hora de votar. ¿Quién es el lobo?'}
             {game.phase === 'role_reveal' && `Se están repartiendo los roles.`}
          </p>
        </CardContent>
      </Card>
      
      <PlayerGrid players={players} />

      {game.phase === 'night' && currentPlayer.isAlive && (
        <NightActions game={game} players={alivePlayers} currentPlayer={currentPlayer} />
      )}
       
       {game.phase !== 'night' && (
         <Card className="mt-8 bg-card/80">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Tu Rol</CardTitle>
            </CardHeader>
            <CardContent>
                <p>Eres un <span className="font-bold">{currentPlayer.role}</span>.</p>
            </CardContent>
         </Card>
       )}
    </div>
  );
}
