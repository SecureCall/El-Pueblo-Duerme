
"use client";

import React from 'react';
import type { Game, Player, GameEvent } from "@/types";
import { PlayerCard } from "./PlayerCard";
import type { MasterActionState } from './MasterActionBar';

interface PlayerGridProps {
    game: Game;
    players: (Player & { causeOfDeath?: GameEvent['type'] | 'other' })[];
    currentPlayer: Player;
    onPlayerClick?: (player: Player) => void;
    clickable?: boolean;
    selectedPlayerIds?: string[];
    highlightedPlayers?: { userId: string, color: string }[];
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
    highlightedPlayers = [],
    votesByPlayer = {},
    masterActionState,
    setMasterActionState,
}: PlayerGridProps) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
      {players.map((player) => {
        const highlight = highlightedPlayers.find(hp => hp.userId === player.userId);
        const playerIsClickable = (clickable && player.isAlive && player.userId !== currentPlayer.userId) || masterActionState.active;
        
        return (
            <div key={player.userId} className="aspect-[3/4]">
                <PlayerCard 
                    game={game}
                    player={player} 
                    currentPlayer={currentPlayer}
                    onClick={onPlayerClick ? () => onPlayerClick(player) : undefined}
                    isClickable={playerIsClickable}
                    isSelected={selectedPlayerIds.includes(player.userId)}
                    highlightColor={highlight?.color}
                    votes={votesByPlayer[player.userId]}
                    masterActionState={masterActionState}
                    setMasterActionState={setMasterActionState}
                />
            </div>
        )
      })}
    </div>
  );
});
