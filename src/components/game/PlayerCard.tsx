
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

interface PlayerCardProps {
  player: Player & { causeOfDeath?: 'werewolf_kill' | 'vote_result' | 'other' };
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
  
  const avatarImage = PlaceHolderImages.find((img) => img.id === `avatar-${getAvatarId(player.userId)}`);

  const cardStyle = highlightColor ? { boxShadow: `0 0 15px 4px ${highlightColor}` } : {};

  if (!player.isAlive) {
    const roleInfo = roleDetails[player.role!] ?? defaultRoleDetail;
    const DeathOverlay = () => {
        switch (player.causeOfDeath) {
            case 'werewolf_kill':
                return (
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-20">
                        <Image src="/zarpa.png" alt="Zarpazo" layout="fill" className="absolute object-contain opacity-80" unoptimized />
                    </div>
                );
            case 'vote_result':
                return <Gavel className="absolute inset-0 m-auto h-16 w-16 text-amber-800/80 z-20" />;
            default:
                return <Skull className="absolute inset-0 m-auto h-16 w-16 text-gray-400/80 z-20" />;
        }
    };
    
    return (
        <Card className="relative flex flex-col items-center justify-between p-2 h-full bg-card/50 rounded-lg overflow-hidden border-2 border-destructive/50">
            <div className="absolute inset-0 bg-black/50 z-10" />
            <div className="relative z-0 w-full h-full flex-grow">
                 <Image 
                    src={roleInfo.image} 
                    alt={roleInfo.name}
                    layout="fill"
                    className="object-cover rounded-md"
                    unoptimized
                />
               <DeathOverlay />
            </div>
            <div className="relative z-20 flex flex-col items-center gap-1 text-center w-full pt-2">
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
