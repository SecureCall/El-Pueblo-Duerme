'use client';

import { useGameSession } from "@/hooks/use-game-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HomeIcon, Trophy, Swords, Shield, Skull } from "lucide-react";
import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { GameMusic } from "@/components/game/GameMusic";
import { ChartContainer, BarChart, XAxis, YAxis, Tooltip, Bar, ResponsiveContainer, Legend, Cell } from 'recharts';
import { roleDetails } from "@/lib/roles";
import { secretObjectives } from "@/lib/objectives";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export default function ProfilePage() {
    const { stats, displayName } = useGameSession();
    const bgImage = PlaceHolderImages.find((img) => img.id === 'game-bg-night');

    const winRate = stats.victories + stats.defeats > 0
        ? Math.round((stats.victories / (stats.victories + stats.defeats)) * 100)
        : 0;

    const roleChartData = Object.entries(stats.roleStats).map(([roleKey, roleStat]) => ({
        name: roleDetails[roleKey as keyof typeof roleDetails]?.name || 'Desconocido',
        Jugadas: roleStat.played,
        Victorias: roleStat.won,
    }));
    
    const unlockedAchievements = stats.achievements.map(id => secretObjectives.find(obj => obj.id === id)).filter(Boolean);

    return (
        <>
            <GameMusic src="/audio/lobby-theme.mp3" />
            <div className="relative min-h-screen w-full flex flex-col items-center p-4 overflow-y-auto">
                {bgImage && (
                    <Image
                        src={bgImage.imageUrl}
                        alt={bgImage.description}
                        fill
                        className="object-cover z-0"
                        data-ai-hint={bgImage.imageHint}
                        priority
                    />
                )}
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

                <main className="relative z-10 w-full max-w-4xl mx-auto space-y-8 text-white py-12">
                    <div className="text-center space-y-2">
                        <h1 className="font-headline text-5xl md:text-6xl font-bold tracking-tight">
                            Perfil de {displayName}
                        </h1>
                        <p className="text-lg text-white/80">
                            Tu legado en Pueblo Duerme.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <Card className="bg-card/80">
                            <CardHeader>
                                <CardTitle className="text-4xl">{stats.victories}</CardTitle>
                                <CardDescription>Victorias</CardDescription>
                            </CardHeader>
                        </Card>
                         <Card className="bg-card/80">
                            <CardHeader>
                                <CardTitle className="text-4xl">{stats.defeats}</CardTitle>
                                <CardDescription>Derrotas</CardDescription>
                            </CardHeader>
                        </Card>
                         <Card className="bg-card/80">
                            <CardHeader>
                                <CardTitle className="text-4xl">{winRate}%</CardTitle>
                                <CardDescription>Tasa de Victoria</CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                    
                    <Card className="bg-card/80">
                        <CardHeader>
                            <CardTitle className="font-headline text-3xl">Rendimiento por Rol</CardTitle>
                        </CardHeader>
                        <CardContent>
                             {roleChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={roleChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                background: "hsl(var(--background))",
                                                border: "1px solid hsl(var(--border))"
                                            }}
                                        />
                                        <Legend wrapperStyle={{fontSize: "14px"}}/>
                                        <Bar dataKey="Victorias" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Jugadas" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-center text-muted-foreground">Juega algunas partidas para ver tus estadísticas por rol.</p>
                            )}
                        </CardContent>
                    </Card>

                     <Card className="bg-card/80">
                        <CardHeader>
                            <CardTitle className="font-headline text-3xl">Historial y Logros</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {stats.history && stats.history.length > 0 ? (
                                    stats.history.map((event, index) => (
                                         <div key={index} className="flex items-center gap-4 p-3 bg-background/50 rounded-lg">
                                            <div className="text-primary">
                                                {event.type === 'victory' && <Trophy />}
                                                {event.type === 'achievement' && <Trophy className="text-yellow-400" />}
                                                {event.type === 'notable_play' && <Swords />}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-bold">{event.title}</p>
                                                <p className="text-sm text-muted-foreground">{event.description}</p>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true, locale: es })}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-muted-foreground">Tu historial está vacío. ¡Juega una partida para empezar a escribir tu leyenda!</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="text-center pt-8">
                        <Button asChild>
                            <Link href="/">
                                <HomeIcon className="mr-2" />
                                Volver al Inicio
                            </Link>
                        </Button>
                    </div>
                </main>
            </div>
        </>
    );
}
