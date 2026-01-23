"use client";

import React from 'react';
import type { Game, Player, GameEvent } from "@/types";
import { PlayerCard } from "./PlayerCard";
import type { MasterActionState } from './MasterActionBar';
import { cn } from "../../lib/utils";

interface PlayerGridProps {
    game: Game;
    players: (Player & { causeOfDeath?: GameEvent['type'] | 'other' })[];
    currentPlayer: Player;
    onPlayerClick?: (player: Player) => void;
    clickable?: boolean;
    selectedPlayerIds?: string[];
    votesByPlayer?: Record<string, string[]>;
    masterActionState: MasterActionState;
    setMasterActionState: React.Dispatch<React.SetStateAction<MasterActionState>>;
}

export const PlayerGrid = React.memo(function PlayerGrid({ 
    game,
    players, 
    currentPlayer,
    onPlayerClick, 
    clickable = false,
    selectedPlayerIds = [], 
    votesByPlayer = {},
    masterActionState,
}: PlayerGridProps) {

  const otherTwinId = game.twins?.find(id => id !== currentPlayer.userId);
  const otherLoverId = game.lovers?.find(id => id !== currentPlayer.userId);

  return (
    <div className={cn(
        "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4",
        masterActionState.active && "cursor-crosshair"
    )}>
      {players.map((player) => {
        
        const isTwin = player.userId === otherTwinId;
        const isLover = player.userId === otherLoverId;

        let highlightColor;
        if (isTwin) highlightColor = 'rgba(135, 206, 250, 0.7)';
        if (isLover) highlightColor = 'rgba(244, 114, 182, 0.7)';
        if (masterActionState.sourceId === player.userId) highlightColor = 'rgba(255, 255, 0, 0.7)';
        
        const isSelf = currentPlayer.userId === player.userId;
        const votesForThisPlayer = votesByPlayer[player.userId] || [];

        const isSilenced = game.silencedPlayerId === player.userId;
        const isExiled = game.exiledPlayerId === player.userId;

        return (
            <div key={player.userId} className="aspect-[3/4]">
                <PlayerCard 
                    player={player} 
                    isCreator={game.creator === player.userId}
                    isSelf={isSelf}
                    isLover={isLover}
                    isExecutionerTarget={currentPlayer.role === 'executioner' && player.userId === currentPlayer.executionerTargetId}
                    isSilenced={isSilenced}
                    isExiled={isExiled}
                    onClick={onPlayerClick}
                    isClickable={clickable && !isSelf}
                    isSelected={selectedPlayerIds.includes(player.userId)}
                    highlightColor={highlightColor}
                    votes={votesForThisPlayer}
                />
            </div>
        )
      })}
    </div>
  );
});
