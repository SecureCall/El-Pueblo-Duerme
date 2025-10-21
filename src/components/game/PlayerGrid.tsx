
"use client";

import type { Player, GameEvent } from "@/types";
import { PlayerCard } from "./PlayerCard";

interface PlayerGridProps {
    players: (Player & { causeOfDeath?: GameEvent['type'] | 'other' })[];
    onPlayerClick?: (player: Player) => void;
    clickable?: boolean;
    selectedPlayerIds?: string[];
}

export function PlayerGrid({ 
    players, 
    onPlayerClick, 
    clickable = false,
    selectedPlayerIds = []
}: PlayerGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
      {players.map((player) => {
        return (
            <div key={player.userId} className="aspect-[3/4]">
                <PlayerCard 
                    player={player} 
                    onClick={onPlayerClick ? () => onPlayerClick(player) : undefined}
                    isClickable={clickable && player.isAlive}
                    isSelected={selectedPlayerIds.includes(player.userId)}
                />
            </div>
        )
      })}
    </div>
  );
}

    
