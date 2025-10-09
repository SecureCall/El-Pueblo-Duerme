"use client";

import type { Player } from "@/types";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { DoctorIcon, HunterIcon, SeerIcon, VillagerIcon, WolfIcon } from "../icons";
import { cn } from "@/lib/utils";

interface RoleRevealProps {
  player: Player;
  onAcknowledge: () => void;
}

const roleDetails: Record<NonNullable<Player['role']>, { name: string; description: string; Icon: React.ElementType; color: string }> = {
    werewolf: {
        name: "Hombre Lobo",
        description: "Cada noche, tú y tus compañeros lobos elegís a un aldeano para eliminar. Durante el día, debéis haceros pasar por aldeanos inocentes.",
        Icon: WolfIcon,
        color: "text-destructive"
    },
    seer: {
        name: "Vidente",
        description: "Cada noche, puedes elegir a un jugador para descubrir su verdadera identidad. Usa esta información sabiamente para guiar a los aldeanos.",
        Icon: SeerIcon,
        color: "text-blue-400"
    },
    doctor: {
        name: "Doctor",
        description: "Cada noche, puedes elegir a un jugador (incluido tú mismo) para protegerlo de los ataques de los lobos. No puedes elegir al mismo jugador dos noches seguidas.",
        Icon: DoctorIcon,
        color: "text-green-400"
    },
    villager: {
        name: "Aldeano",
        description: "Eres un miembro del pueblo. Tu único poder es tu voz y tu voto. Presta atención durante el día y vota para eliminar a quienes creas que son hombres lobo.",
        Icon: VillagerIcon,
        color: "text-primary-foreground/80"
    },
    hunter: {
        name: "Cazador",
        description: "Si eres eliminado (ya sea de noche o por votación), puedes disparar tu última bala y llevarte a otro jugador contigo a la tumba.",
        Icon: HunterIcon,
        color: "text-yellow-500"
    }
}

export function RoleReveal({ player, onAcknowledge }: RoleRevealProps) {
    if (!player.role) {
        return (
            <div className="text-center p-8">
                <p>Asignando roles...</p>
            </div>
        )
    }

    const details = roleDetails[player.role];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm animate-in fade-in">
        <Card className="w-full max-w-md m-4 text-center animate-in zoom-in-95">
            <CardHeader>
                <CardDescription>Tu rol es...</CardDescription>
                <CardTitle className={cn("font-headline text-5xl", details.color)}>
                    {details.name}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <details.Icon className={cn("h-24 w-24 mx-auto", details.color)} />
                <p className="text-muted-foreground text-lg">
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
