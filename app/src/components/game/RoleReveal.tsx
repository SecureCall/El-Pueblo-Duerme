
"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { roleDetails, defaultRoleDetail } from "@/lib/roles";
import { processNight } from "@/lib/game-logic";
import { useFirebase } from "@/firebase";
import { useGameSession } from "@/hooks/use-game-session";


interface RoleRevealProps {
  player: Player;
  onAcknowledge: () => void;
}

export function RoleReveal({ player, onAcknowledge }: RoleRevealProps) {
    const { firestore } = useFirebase();
    const { userId } = useGameSession();

    if (!player.role || !player.gameId) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                <p>Asignando roles...</p>
            </div>
        )
    }

    const details = roleDetails[player.role] ?? defaultRoleDetail;
    const bgImage = PlaceHolderImages.find((img) => img.id === details.bgImageId);

    const handleAcknowledge = async () => {
        onAcknowledge();
        // If the current user is the creator, they are responsible for kicking off the next phase
        // after everyone has had a chance to see their role.
        if (player.userId === userId && firestore) {
            // We removed the automatic timer, so the creator's click moves the game forward
            // await processNight(firestore, player.gameId);
        }
    };


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
                <Button className="w-full text-lg" onClick={handleAcknowledge}>Entendido</Button>
            </CardFooter>
        </Card>
    </div>
  );
}
