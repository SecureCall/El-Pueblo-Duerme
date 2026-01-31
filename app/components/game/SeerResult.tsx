"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

interface SeerResultProps {
    targetName: string;
    isWerewolf: boolean;
}

export function SeerResult({ targetName, isWerewolf }: SeerResultProps) {
    return (
        <Card className="mt-8 bg-card/90 border-blue-400/50">
            <CardHeader className="text-center">
                <CardTitle className="font-headline text-2xl text-blue-400">Visión del Vidente</CardTitle>
                <CardDescription>Has escudriñado en el alma de {targetName}.</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
                {isWerewolf ? (
                    <>
                        <div className="relative h-24 w-24 mx-auto">
                            <Image src="/roles/werewolf.png" alt="Hombre Lobo" fill className="object-contain" unoptimized/>
                        </div>
                        <p className="text-lg font-bold text-destructive">¡Es un Hombre Lobo!</p>
                        <p className="text-muted-foreground">La oscuridad y la malicia residen en su corazón. Debes alertar al pueblo.</p>
                    </>
                ) : (
                    <>
                        <div className="relative h-24 w-24 mx-auto">
                            <Image src="/roles/villager.png" alt="Aldeano" fill className="object-contain" unoptimized/>
                        </div>
                        <p className="text-lg font-bold text-primary-foreground/90">Es un Aldeano Inocente.</p>
                        <p className="text-muted-foreground">No has encontrado rastro de maldad en esta persona. Debes seguir buscando.</p>
                    </>
                )}
                 <p className="text-sm italic text-muted-foreground pt-4">Usa esta información con sabiduría. La noche es larga...</p>
            </CardContent>
        </Card>
    );
}
