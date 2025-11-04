
"use client";

import React from 'react';
import type { Player, GameEvent } from "@/types";
import { PlayerCard } from "./PlayerCard";
import type { MasterActionState } from './MasterActionBar';

interface PlayerGridProps {
    creatorId: string;
    players: (Player & { causeOfDeath?: GameEvent['type'] | 'other' })[];
    currentPlayer: Player;
    onPlayerClick?: (player: Player) => void;
    clickable?: boolean;
    selectedPlayerIds?: string[];
    highlightedPlayers?: { userId: string, color: string }[];
    votesByPlayer?: Record<string, string[]>;
    masterActionState?: MasterActionState;
    setMasterActionState?: React.Dispatch<React.SetStateAction<MasterActionState>>;
}

export const PlayerGrid = React.memo(function PlayerGrid({ 
    creatorId,
    players, 
    currentPlayer,
    onPlayerClick, 
    clickable = false,
    selectedPlayerIds = [], 
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
                    isCreator={creatorId === player.userId}
                    isSelf={currentPlayer.userId === player.userId}
                    isLover={currentPlayer.isLover && player.isLover && currentPlayer.userId !== player.userId}
                    isExecutionerTarget={currentPlayer.role === 'executioner' && player.userId === currentPlayer.executionerTargetId}
                    player={player} 
                    onClick={onPlayerClick}
                    isClickable={clickable && player.isAlive && player.userId !== currentPlayer.userId}
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
