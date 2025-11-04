
"use client";

import React from 'react';
import type { Game, Player, GameEvent } from "@/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Bot, Crown, Gavel, Skull, Heart, Swords, Edit } from "lucide-react";
import { Badge } from "../ui/badge";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { roleDetails, defaultRoleDetail } from "@/lib/roles";
import Image from "next/image";
import { VampireIcon } from "../icons";

interface PlayerCardProps {
  game: Game;
  player: Player & { causeOfDeath?: GameEvent['type'] | 'other' };
  currentPlayer: Player;
  onClick?: (player: Player) => void;
  isClickable?: boolean;
  isSelected?: boolean;
  highlightColor?: string;
  votes?: string[];
}

export const PlayerCard = React.memo(function PlayerCard({ game, player, currentPlayer, onClick, isClickable, isSelected, highlightColor, votes }: PlayerCardProps) {
  if (!player) return null;

 if (!player.isAlive) {
    const roleInfo = player.role ? (roleDetails[player.role] ?? defaultRoleDetail) : defaultRoleDetail;

    const DeathOverlay = () => {
      const baseClasses = "absolute inset-0 z-20 flex items-center justify-center";
      const iconClasses = "h-16 w-16 opacity-80";

      switch (player.causeOfDeath) {
        case 'werewolf_kill':
          return (
            <div className={cn(baseClasses)}>
                <img src="/zarpazo.svg" alt="Muerte por lobo" className={cn(iconClasses, "filter-destructive")} />
            </div>
          );
        case 'vote_result':
          return (
            <div className={baseClasses}>
              <Gavel className={cn(iconClasses, "text-amber-800")} />
            </div>
          );
        case 'vampire_kill':
             return (
            <div className={baseClasses}>
                <VampireIcon className={cn(iconClasses, "text-red-900")} />
            </div>
            );
        case 'hunter_shot':
        case 'troublemaker_duel':
             return (
            <div className={baseClasses}>
                <Skull className={cn(iconClasses, "text-destructive")} />
            </div>
            );
        case 'lover_death':
        case 'special':
            return (
            <div className={baseClasses}>
                <Heart className={cn(iconClasses, "text-pink-400")} />
            </div>
            );
        default:
          return (
             <div className={cn(baseClasses)}>
                <Skull className={cn(iconClasses, "text-gray-400")} />
            </div>
          );
      }
    };
    
    return (
        <Card className="relative flex flex-col items-center justify-between p-2 h-full bg-card/50 rounded-lg overflow-hidden border-2 border-destructive/50">
            <div className="absolute inset-0 z-0">
                <Image 
                    src={roleInfo.image} 
                    alt={roleInfo.name}
                    fill
                    className="object-cover rounded-md"
                    unoptimized
                />
            </div>
            <div className="absolute inset-0 bg-black/60 z-10" />
            <DeathOverlay />
            <div className="relative z-20 flex flex-col items-center gap-1 text-center w-full mt-auto pt-2 bg-black/50 pb-1">
                <p className="font-semibold text-center truncate w-full line-through text-lg text-primary-foreground">{player.displayName}</p>
                <div className="text-sm font-bold text-center text-muted-foreground">
                    Era {roleInfo.name}
                </div>
            </div>
        </Card>
    );
}

  const cardStyle = highlightColor ? { boxShadow: `0 0 15px 4px ${highlightColor}` } : {};
  const isSelf = player.userId === currentPlayer.userId;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
            <Card
              className={cn(
                "flex flex-col items-center justify-center p-4 transition-all duration-300 relative h-full",
                "bg-card/80",
                isClickable && "cursor-pointer hover:scale-105 hover:bg-card/100",
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
              onClick={() => onClick?.(player)}
              style={cardStyle}
            >
              {isSelf && (
                <div className="absolute top-1 right-1 bg-secondary/80 rounded-full p-1 cursor-pointer hover:bg-secondary" onClick={() => onClick?.(player)}>
                  <Edit className="h-4 w-4 text-secondary-foreground" />
                  <span className="sr-only">Cambiar avatar</span>
                </div>
              )}
              {game && player.userId === game.creator && (
                 <Crown className="absolute -top-2 -left-2 h-6 w-6 text-yellow-400 rotate-[-15deg]" />
              )}
              {votes && votes.length > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 z-10">{votes.length}</Badge>
              )}
              {player.isAI && (
                <Bot className="absolute -top-2 -left-2 z-10 h-5 w-5 text-muted-foreground" />
              )}
              {player.princeRevealed && (
                 <Crown className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 h-5 w-5 text-yellow-400" />
              )}
               {player.isLover && currentPlayer.isLover && player.userId !== currentPlayer.userId && (
                 <Heart className="absolute -top-2 -right-2 z-10 h-5 w-5 text-pink-400" />
              )}
               {currentPlayer.role === 'executioner' && player.userId === currentPlayer.executionerTargetId && (
                 <Swords className="absolute -top-2 -right-2 z-10 h-5 w-5 text-gray-400" />
               )}
              <CardContent className="p-0">
                <Avatar className="h-20 w-20 border-2 border-border">
                  <AvatarImage src={player.avatarUrl} alt={player.displayName} />
                  <AvatarFallback>{player.displayName.substring(0, 2)}</AvatarFallback>
                </Avatar>
              </CardContent>
              <CardFooter className="p-0 pt-3 flex flex-col items-center gap-1">
                <p className="font-semibold text-center truncate w-full">{player.displayName}</p>
              </CardFooter>
            </Card>
        </TooltipTrigger>
         {votes && votes.length > 0 && (
            <TooltipContent>
                <p>Votos de: {votes.join(', ')}</p>
            </TooltipContent>
        )}
         {player.princeRevealed && (
             <TooltipContent>
                <p>¡Príncipe revelado! Inmune al linchamiento.</p>
            </TooltipContent>
         )}
         {player.isLover && currentPlayer.isLover && player.userId !== currentPlayer.userId && (
              <TooltipContent>
                <p>Tu enamorado/a.</p>
              </TooltipContent>
         )}
         {currentPlayer.role === 'executioner' && player.userId === currentPlayer.executionerTargetId && (
              <TooltipContent>
                <p>Tu objetivo. Debes convencer al pueblo para que lo linchen.</p>
              </TooltipContent>
         )}
         {isSelf && (
            <TooltipContent>
                <p>¡Eres tú! Haz clic para cambiar tu avatar.</p>
            </TooltipContent>
         )}
      </Tooltip>
    </TooltipProvider>
  );
});

    