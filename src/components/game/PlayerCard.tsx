
"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Bot, Crown, Skull, Gavel } from "lucide-react";
import { Badge } from "../ui/badge";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { roleDetails, defaultRoleDetail } from "@/lib/roles";
import Image from "next/image";
import type { SVGProps } from "react";

function ZarpazoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
        <g transform="rotate(-15 50 50)">
            <path d="M10 10 L90 90" stroke="red" strokeWidth="5" strokeLinecap="round"/>
            <path d="M30 10 L110 90" stroke="red" strokeWidth="5" strokeLinecap="round" />
            <path d="M50 10 L130 90" stroke="red" strokeWidth="5" strokeLinecap="round" />
        </g>
    </svg>
  )
}

interface PlayerCardProps {
  player: Player & { causeOfDeath?: 'werewolf_kill' | 'vote_result' | 'other' };
  onClick?: () => void;
  isClickable?: boolean;
  isSelected?: boolean;
  highlightColor?: string;
  votes?: string[];
}

export function PlayerCard({ player, onClick, isClickable, isSelected, highlightColor, votes }: PlayerCardProps) {
  
  const getAvatarId = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    const totalAvatars = 16;
    return (Math.abs(hash) % totalAvatars) + 1;
  }
  
  const avatarImage = PlaceHolderImages.find((img) => img.id === `avatar-${getAvatarId(player.userId)}`);

  const cardStyle = highlightColor ? { boxShadow: `0 0 15px 4px ${highlightColor}` } : {};

 if (!player.isAlive) {
    const roleInfo = roleDetails[player.role!] ?? defaultRoleDetail;

    const DeathOverlay = () => {
      const baseClasses = "absolute inset-0 z-20 flex items-center justify-center";
      const iconClasses = "h-16 w-16 opacity-80";

      switch (player.causeOfDeath) {
        case 'werewolf_kill':
          return (
            <div className={baseClasses}>
                <ZarpazoIcon className={cn(iconClasses, "text-red-500")} />
            </div>
          );
        case 'vote_result':
          return (
            <div className={baseClasses}>
              <Gavel className={cn(iconClasses, "text-amber-800")} />
            </div>
          );
        default:
          return (
            <div className={baseClasses}>
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
