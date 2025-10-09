"use client";

import type { Player } from "@/types";
import { PlayerCard } from "./PlayerCard";

interface PlayerGridProps {
    players: Player[];
    onPlayerClick?: (player: Player) => void;
    clickable?: boolean;
    selectedPlayerIds?: string[];
    highlightedPlayers?: { userId: string, color: string }[];
}

export function PlayerGrid({ 
    players, 
    onPlayerClick, 
    clickable = false,
    selectedPlayerIds = [], 
    highlightedPlayers = []
}: PlayerGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
      {players.map((player) => {
        const highlight = highlightedPlayers.find(p => p.userId === player.userId);
        return (
            <PlayerCard 
                key={player.userId} 
                player={player} 
                onClick={onPlayerClick ? () => onPlayerClick(player) : undefined}
                isClickable={clickable}
                isSelected={selectedPlayerIds.includes(player.userId)}
                highlightColor={highlight?.color}
            />
        )
      })}
    </div>
  );
}
