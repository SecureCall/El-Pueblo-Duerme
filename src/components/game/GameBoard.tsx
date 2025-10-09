"use client";

import type { Game, Player } from "@/types";
import { RoleReveal } from "./RoleReveal";
import { PlayerCard } from "./PlayerCard";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useEffect, useState } from "react";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "../ui/button";

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
    // This is a naive way to handle phase change. A better approach would be a Cloud Function
    // that checks if all players have acknowledged, but this works for a demo.
    if (game.phase === 'role_reveal') {
      if (game.creator === currentPlayer.userId) {
        await updateDoc(doc(db, "games", game.id), { phase: 'night' });
      }
    }
  };

  if (showRole) {
    return <RoleReveal player={currentPlayer} onAcknowledge={handleAcknowledgeRole} />;
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-8">
      <Card className="text-center bg-card/80">
        <CardHeader>
          <CardTitle className="font-headline text-3xl">
            {game.phase === 'night' && `Noche ${game.currentRound}`}
            {game.phase === 'day' && `Día ${game.currentRound}`}
            {game.phase === 'voting' && `Votación`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
             {game.phase === 'night' && 'La noche cae sobre el pueblo. Silencio...'}
             {game.phase === 'day' && 'El sol sale. El pueblo se reúne para decidir.'}
             {game.phase === 'voting' && 'Es hora de votar. ¿Quién es el lobo?'}
          </p>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {players.map((player) => (
          <PlayerCard key={player.userId} player={player} />
        ))}
      </div>

       <Card className="mt-8 bg-card/80">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Tus Acciones</CardTitle>
        </CardHeader>
        <CardContent>
            <p>Aquí irán las acciones específicas de tu rol para la fase actual.</p>
            <p className="font-bold">Tu rol: {currentPlayer.role}</p>
            <Button className="mt-4">Acción de ejemplo</Button>
        </CardContent>
       </Card>
    </div>
  );
}
