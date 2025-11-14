
'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { collection, query, where, Timestamp } from 'firebase/firestore';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import type { Game } from '@/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { GameMusic } from '@/components/game/GameMusic';
import { playNarration } from '@/lib/sounds';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Loader2, HomeIcon } from 'lucide-react';
import { EnterNameModal } from '@/components/game/EnterNameModal';
import { useGameSession } from '@/hooks/use-game-session';
import { useToast } from '@/hooks/use-toast';
import { getMillis } from '@/lib/utils';
import { joinGame } from '@/lib/firebase-client-actions';

function GameCard({ game }: { game: Game }) {
    const { displayName, userId, avatarUrl } = useGameSession();
    const router = useRouter();
    const [isJoining, setIsJoining] = useState(false);
    const { firestore } = useFirebase();

    const handleJoin = async () => {
        if (!displayName || !userId || !avatarUrl || !firestore) {
            // Logic to handle missing name is in the parent component
            return;
        }
        setIsJoining(true);
        const result = await joinGame(firestore, game.id, userId, displayName, avatarUrl);
        if (result.error) {
            alert(result.error);
            setIsJoining(false);
        } else {
            router.push(`/game/${game.id}`);
        }
    }

    return (
        <Card className="bg-card/80 border-border/50 transition-all hover:shadow-lg hover:border-primary">
            <CardHeader>
                <CardTitle className="truncate font-headline text-2xl">{game.name}</CardTitle>
                <CardDescription>Creada por {game.players.find(p => p.userId === game.creator)?.displayName || 'alguien'}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-5 w-5" />
                    <span className="font-bold">{game.players.length} / {game.maxPlayers}</span>
                </div>
                <Button onClick={handleJoin} disabled={isJoining || !displayName || game.players.length >= game.maxPlayers}>
                     {isJoining ? <Loader2 className="animate-spin" /> : "Unirse"}
                </Button>
            </CardContent>
        </Card>
    );
}


export default function PublicGamesPage() {
    const bgImage = PlaceHolderImages.find((img) => img.id === 'game-bg-night');
    const { firestore } = useFirebase();
    const { displayName, setDisplayName } = useGameSession();
    const { toast } = useToast();
    const [isNameModalOpen, setIsNameModalOpen] = useState(false);

    useEffect(() => {
        // Only open the modal if the display name is not set.
        if (!displayName) {
            setIsNameModalOpen(true);
        }
    }, [displayName]);


    const gamesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'games'),
            where('settings.isPublic', '==', true),
            where('status', '==', 'waiting')
        );
    }, [firestore]);

    const { data: publicGames, isLoading } = useCollection<Game>(gamesQuery);

    const sortedGames = useMemo(() => {
        if (!publicGames) return [];
        // Filter out stale games on the client and sort
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        return publicGames
            .filter(game => (now - getMillis(game.lastActiveAt)) < fiveMinutes)
            .sort((a, b) => getMillis(b.lastActiveAt) - getMillis(a.lastActiveAt));
    }, [publicGames]);

    useEffect(() => {
        playNarration('salas.mp3');
    }, []);

    const handleNameSubmit = (name: string) => {
        if (name.trim().length < 2 || name.trim().length > 20) {
            toast({
                variant: 'destructive',
                title: "Nombre inválido",
                description: "El nombre debe tener entre 2 y 20 caracteres.",
            });
            return;
        }
        setDisplayName(name);
        setIsNameModalOpen(false);
    }

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center gap-4 text-white">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p>Buscando partidas públicas...</p>
                </div>
            );
        }

        if (!sortedGames || sortedGames.length === 0) {
            return (
                <div className="text-center text-white">
                    <h2 className="text-2xl font-bold">No hay partidas públicas disponibles</h2>
                    <p className="text-white/80 mt-2">¿Por qué no creas tú una y la haces pública?</p>
                </div>
            );
        }

        return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedGames.map(game => (
                    <GameCard key={game.id} game={game} />
                ))}
            </div>
        );
    }

    return (
        <>
            <GameMusic src="/audio/lobby-theme.mp3" />
             <EnterNameModal
                isOpen={isNameModalOpen}
                onNameSubmit={handleNameSubmit}
            />
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

                <main className="relative z-10 w-full max-w-6xl mx-auto space-y-8 text-white py-12">
                    <div className="text-center space-y-2">
                        <h1 className="font-headline text-5xl md:text-6xl font-bold tracking-tight">
                            Salas Públicas
                        </h1>
                        <p className="text-lg text-white/80">
                            Únete a una partida abierta y conoce a nuevos jugadores.
                        </p>
                    </div>

                    {renderContent()}

                     <div className="text-center pt-8">
                        <Button asChild>
                            <Link href="/">
                                <HomeIcon className="mr-2 h-5 w-5"/>
                                Volver al Inicio
                            </Link>
                        </Button>
                    </div>
                </main>
            </div>
        </>
    );
}
