
"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Skull } from "lucide-react";
import { Badge } from "../ui/badge";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { Bot, Crown } from "lucide-react";

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  isClickable?: boolean;
  isSelected?: boolean;
  highlightColor?: string;
  votes?: string[];
}

export function PlayerCard({ player, onClick, isClickable, isSelected, highlightColor, votes }: PlayerCardProps) {
  // Simple hash function to get a consistent avatar for a user
  const getAvatarId = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    const totalAvatars = 16; // Should match number of avatars in placeholder-images.json
    return (Math.abs(hash) % totalAvatars) + 1;
  }
  
  const avatarId = getAvatarId(player.userId);
  const avatarImage = PlaceHolderImages.find((img) => img.id === `avatar-${avatarId}`);

  const cardStyle = highlightColor ? { boxShadow: `0 0 15px 4px ${highlightColor}` } : {};

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
            <Card
              className={cn(
                "flex flex-col items-center justify-center p-4 transition-all duration-300 relative",
                !player.isAlive ? "bg-muted/30 grayscale opacity-60" : "bg-card/80",
                isClickable && player.isAlive && "cursor-pointer hover:scale-105 hover:bg-card/100",
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
              onClick={player.isAlive ? onClick : undefined}
              style={cardStyle}
            >
              {votes && votes.length > 0 && (
                <Badge variant="destructive" className="absolute -top-2 -right-2 z-10">{votes.length}</Badge>
              )}
              {player.isAI && (
                <Bot className="absolute -top-2 -left-2 z-10 h-5 w-5 text-muted-foreground" />
              )}
              {player.princeRevealed && (
                 <Crown className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 h-5 w-5 text-yellow-400" />
              )}
              <CardContent className="p-0">
                <Avatar className="h-20 w-20 border-2 border-border">
                  <AvatarImage src={avatarImage?.imageUrl || '/avatar-default.png'} data-ai-hint={avatarImage?.imageHint} />
                  <AvatarFallback>{player.displayName.substring(0, 2)}</AvatarFallback>
                </Avatar>
              </CardContent>
              <CardFooter className="p-0 pt-3 flex flex-col items-center gap-1">
                <p className="font-semibold text-center truncate w-full">{player.displayName}</p>
                {!player.isAlive && (
                    <div className="flex items-center gap-1 text-xs text-destructive flex-col">
                        <div className="flex items-center gap-1">
                         <Skull className="h-4 w-4" />
                         <span>Eliminado</span>
                        </div>
                        <span className="font-bold uppercase">{player.role}</span>
                    </div>
                )}
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
      </Tooltip>
    </TooltipProvider>
  );
}
