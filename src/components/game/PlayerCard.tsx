
"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Bot, Crown } from "lucide-react";
import { Badge } from "../ui/badge";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { roleDetails, defaultRoleDetail } from "@/lib/roles";
import Image from "next/image";

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

  if (!player.isAlive) {
    const roleInfo = roleDetails[player.role!] ?? defaultRoleDetail;
    return (
      <Card
        className="flex flex-col items-center justify-between p-4 h-full bg-muted/30 relative overflow-hidden"
      >
        <CardContent className="p-0 relative">
          <Avatar className="h-20 w-20 border-2 border-border grayscale">
            <AvatarImage src={avatarImage?.imageUrl || '/avatar-default.png'} data-ai-hint={avatarImage?.imageHint} />
            <AvatarFallback>{player.displayName.substring(0, 2)}</AvatarFallback>
          </Avatar>
           <div className="absolute inset-0 flex items-center justify-center">
            <Image 
                src="/zarpa.png"
                alt="Eliminado"
                width={100}
                height={100}
                className="object-contain opacity-80"
                unoptimized
            />
          </div>
        </CardContent>
        <CardFooter className="p-0 pt-3 flex flex-col items-center gap-1 text-center w-full">
          <p className="font-semibold text-center truncate w-full line-through">{player.displayName}</p>
          <div 
            className={cn(
                "absolute bottom-0 left-0 right-0 p-1 text-xs font-bold text-center text-white bg-black/50",
                roleInfo.color.replace('text-', 'bg-')
            )}>
              Era {roleInfo.name}
          </div>
        </CardFooter>
      </Card>
    );
  }

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
              onClick={onClick}
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
