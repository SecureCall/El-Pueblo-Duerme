
"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { roleDetails, defaultRoleDetail } from "@/lib/roles";

interface RoleRevealCardProps {
  player: Player;
}

export function RoleRevealCard({ player }: RoleRevealCardProps) {
    if (!player.role) {
        return (
            <Card className="h-full flex items-center justify-center bg-muted/30">
                <p>Rol desconocido</p>
            </Card>
        );
    }

    const details = roleDetails[player.role] ?? defaultRoleDetail;

  return (
    <Card className={cn("w-full h-full text-center bg-card/90 border-2", details.color.replace('text-', 'border-'))}>
        <CardHeader className="p-2">
            <CardTitle className={cn("text-lg font-bold", details.color)}>
                {details.name}
            </CardTitle>
        </CardHeader>
        <CardContent className="p-2 pt-0 flex flex-col items-center justify-center gap-2">
            <div className="relative h-20 w-20 mx-auto">
                <Image 
                    src={details.image} 
                    alt={details.name}
                    fill
                    className="object-contain"
                    unoptimized
                />
            </div>
            <CardDescription className="text-xs">
                {player.displayName} era {details.name}.
            </CardDescription>
        </CardContent>
    </Card>
  );
}
