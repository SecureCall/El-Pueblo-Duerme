"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { SkullIcon } from "../icons";

interface PlayerCardProps {
  player: Player;
  onClick?: () => void;
  isClickable?: boolean;
  isSelected?: boolean;
  highlightColor?: string;
}

export function PlayerCard({ player, onClick, isClickable, isSelected, highlightColor }: PlayerCardProps) {
  // Simple hash function to get a consistent avatar for a user
  const getAvatarId = (userId: string) => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    const totalAvatars = 12; // Should match number of avatars in placeholder-images.json
    return (Math.abs(hash) % totalAvatars) + 1;
  }
  
  const avatarId = getAvatarId(player.userId);
  const avatarImage = PlaceHolderImages.find((img) => img.id === `avatar-${avatarId}`);

  const cardStyle = highlightColor ? { boxShadow: `0 0 12px 3px ${highlightColor}` } : {};

  return (
    <Card
      className={cn(
        "flex flex-col items-center justify-center p-4 transition-all duration-300",
        !player.isAlive ? "bg-muted/30 grayscale opacity-60" : "bg-card/80",
        isClickable && "cursor-pointer hover:scale-105 hover:bg-card/100",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
      onClick={onClick}
      style={cardStyle}
    >
      <CardContent className="p-0">
        <Avatar className="h-20 w-20 border-2 border-border">
          <AvatarImage src={avatarImage?.imageUrl} data-ai-hint={avatarImage?.imageHint} />
          <AvatarFallback>{player.displayName.substring(0, 2)}</AvatarFallback>
        </Avatar>
      </CardContent>
      <CardFooter className="p-0 pt-3 flex flex-col items-center gap-1">
        <p className="font-semibold text-center truncate w-full">{player.displayName}</p>
        {!player.isAlive && (
            <div className="flex items-center gap-1 text-sm text-destructive">
                <SkullIcon className="h-4 w-4" />
                <span>Eliminado</span>
            </div>
        )}
      </CardFooter>
    </Card>
  );
}
