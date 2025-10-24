
"use client";

import React from 'react';
import type { Game, Player, GameEvent } from "@/types";
import { PlayerCard } from "./PlayerCard";

interface PlayerGridProps {
    game: Game;
    players: (Player & { causeOfDeath?: GameEvent['type'] | 'other' })[];
    currentPlayer: Player;
    onPlayerClick?: (player: Player) => void;
    isClickable?: boolean;
    isSelected?: string[];
    highlightedPlayers?: { userId: string, color: string }[];
    votesByPlayer?: Record<string, string[]>;
}

export const PlayerGrid = React.memo(function PlayerGrid({ 
    game,
    players, 
    currentPlayer,
    onPlayerClick, 
    isClickable = false,
    isSelected: selectedPlayerIds = [], 
    highlightedPlayers = [],
    votesByPlayer = {},
}: PlayerGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
      {players.map((player) => {
        const highlight = highlightedPlayers.find(hp => hp.userId === player.userId);
        return (
            <div key={player.userId} className="aspect-[3/4]">
                <PlayerCard 
                    game={game}
                    player={player} 
                    currentPlayer={currentPlayer}
                    onClick={onPlayerClick}
                    isClickable={isClickable && player.userId !== currentPlayer.userId}
                    isSelected={selectedPlayerIds.includes(player.userId)}
                    highlightColor={highlight?.color}
                    votes={votesByPlayer[player.userId]}
                />
            </div>
        )
      })}
    </div>
  );
});
