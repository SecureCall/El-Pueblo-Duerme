
"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { roleDetails, defaultRoleDetail } from "@/lib/roles";


interface RoleRevealProps {
  player: Player;
  onAcknowledge: () => void;
}

export function RoleReveal({ player, onAcknowledge }: RoleRevealProps) {
    if (!player.role) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                <p>Asignando roles...</p>
            </div>
        )
    }

    const details = roleDetails[player.role] ?? defaultRoleDetail;
    const bgImage = PlaceHolderImages.find((img) => img.id === details.bgImageId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in">
        {bgImage && (
            <Image
                src={bgImage.imageUrl}
                alt={bgImage.description}
                fill
                className="object-cover z-0"
                data-ai-hint={bgImage.imageHint}
                priority
                unoptimized
            />
        )}
        <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
        
        <Card className="w-full max-w-md m-4 text-center animate-in zoom-in-95 bg-card/80 border-border/50 z-10">
            <CardHeader>
                <CardDescription>Tu rol es...</CardDescription>
                <CardTitle className={cn("font-headline text-5xl", details.color)}>
                    {details.name}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="relative h-48 w-48 mx-auto">
                    <Image 
                        src={details.image} 
                        alt={details.name}
                        fill
                        className="object-contain"
                        unoptimized
                        priority
                    />
                </div>
                <p className="text-lg font-bold italic text-primary-foreground/90">
                    {details.atmosphere}
                </p>
                <p className="text-muted-foreground text-base">
                    {details.description}
                </p>
            </CardContent>
            <CardFooter>
                <Button className="w-full text-lg" onClick={onAcknowledge}>Entendido</Button>
            </CardFooter>
        </Card>
    </div>
  );
}
