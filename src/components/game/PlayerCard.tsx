
"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Bot, Crown, Skull } from "lucide-react";
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

function GallowsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2v2"/>
      <path d="M12 4h8"/>
      <path d="M18 4v5"/>
      <path d="M12 14c0-2 2-4 4-4s4 2 4 4c0 2.2-1.8 4-4 4-4 0-4-2-4-2"/>
      <path d="M12 22V10"/>
      <path d="M6 22V4"/>
      <path d: "M10 4H2"/>
    </svg>
  );
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
    const DeathIcon = () => {
        switch (player.causeOfDeath) {
            case 'vote_result':
                return <GallowsIcon className="absolute inset-0 m-auto h-16 w-16 text-amber-800/80 z-20" />;
            case 'werewolf_kill':
                 return (
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-20">
                        <Image src="/zarpa.png" alt="Zarpazo" width={80} height={80} className="absolute object-contain opacity-90 rotate-[20deg] scale-125" unoptimized />
                        <Image src="/zarpa.png" alt="Zarpazo" width={60} height={60} className="absolute object-contain opacity-80 rotate-[-30deg] scale-100 translate-x-2" unoptimized />
                        <Image src="/zarpa.png" alt="Zarpazo" width={70} height={70} className="absolute object-contain opacity-85 rotate-[10deg] scale-110 -translate-y-1" unoptimized />
                    </div>
                );
            default:
                return <Skull className="absolute inset-0 m-auto h-16 w-16 text-gray-400/80 z-20" />;
        }
    };
    
    return (
        <div className="relative flex flex-col items-center justify-between p-4 h-full bg-muted/30 rounded-lg overflow-hidden">
            <div className="absolute inset-0 bg-black/60 z-10" />
            <div className="relative z-20 w-full flex flex-col items-center">
                <div className="relative h-20 w-20">
                    <Avatar className="h-20 w-20 border-2 border-border grayscale">
                        <AvatarImage src={avatarImage?.imageUrl || '/avatar-default.png'} data-ai-hint={avatarImage?.imageHint} />
                        <AvatarFallback>{player.displayName.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                   <DeathIcon />
                </div>
            </div>
            <div className="relative z-20 flex flex-col items-center gap-1 text-center w-full pt-3">
                <p className="font-semibold text-center truncate w-full line-through text-lg">{player.displayName}</p>
                <div className="text-sm font-bold text-center text-muted-foreground">
                    Era {roleInfo.name}
                </div>
            </div>
        </div>
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
