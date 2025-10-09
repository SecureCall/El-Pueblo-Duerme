"use client";

import type { Player } from "@/types";
import { PlayerCard } from "./PlayerCard";

interface PlayerGridProps {
    players: Player[];
    onPlayerClick?: (player: Player) => void;
    clickable?: boolean;
    selectedPlayerIds?: string[]; // Changed to array
    highlightedPlayers?: { userId: string, color: string }[];
}

export function PlayerGrid({ 
    players, 
    onPlayerClick, 
    clickable = false,
    selectedPlayerIds = [], // Default to empty array
    highlightedPlayers = []
}: PlayerGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {players.map((player) => {
        const highlight = highlightedPlayers.find(p => p.userId === player.userId);
        return (
            <PlayerCard 
                key={player.userId} 
                player={player} 
                onClick={onPlayerClick ? () => onPlayerClick(player) : undefined}
                isClickable={clickable && player.isAlive}
                isSelected={selectedPlayerIds.includes(player.userId)} // Check if included in array
                highlightColor={highlight?.color}
            />
        )
      })}
    </div>
  );
}
