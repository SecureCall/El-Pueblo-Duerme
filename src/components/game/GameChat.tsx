
"use client";

import { useState, useRef, useEffect } from 'react';
import type { Game, Player, ChatMessage } from '@/types';
import { useFirebase } from '@/firebase';
import { useGameState } from '@/hooks/use-game-state';
import { submitChatMessage } from '@/lib/firebase-actions';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface GameChatProps {
    game: Game;
    currentPlayer: Player;
}

const quickPhrases = [
    "¡Soy aldeano!",
    "Esto es muy sospechoso...",
    "Votemos por unanimidad.",
    "Creo que [jugador] miente.",
    "¿Alguna pista, vidente?",
];

export function GameChat({ game, currentPlayer }: GameChatProps) {
    const { firestore } = useFirebase();
    const { messages } = useGameState(game.id);
    const [newMessage, setNewMessage] = useState('');
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({
                top: scrollAreaRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [messages]);

    const handleSendMessage = async (text?: string) => {
        const messageText = text || newMessage;
        if (!messageText.trim() || !firestore || !currentPlayer.isAlive) {
            if (!currentPlayer.isAlive) {
                toast({ variant: "destructive", title: "Los muertos no hablan."});
            }
            return;
        }

        const message: Omit<ChatMessage, 'createdAt' | 'id'> = {
            senderId: currentPlayer.userId,
            senderName: currentPlayer.displayName,
            text: messageText,
            round: game.currentRound,
        };

        const result = await submitChatMessage(firestore, game.id, message);

        if (result.success) {
            setNewMessage('');
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
    };
    
    return (
        <Card className="bg-card/80 h-full flex flex-col">
            <CardHeader>
                <CardTitle className="font-headline text-xl">Chat del Pueblo</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full px-6" ref={scrollAreaRef}>
                    <div className="space-y-4">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col",
                                    msg.senderId === currentPlayer.userId ? "items-end" : "items-start"
                                )}
                            >
                                <span className={cn(
                                    "text-xs text-muted-foreground px-2",
                                    msg.senderId === currentPlayer.userId ? "text-right" : "text-left"
                                )}>
                                    {msg.senderName}
                                </span>
                                <div
                                    className={cn(
                                        "rounded-lg px-3 py-2 max-w-xs break-words",
                                        msg.senderId === currentPlayer.userId
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-secondary text-secondary-foreground"
                                    )}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className="p-4 flex-col gap-2 border-t mt-auto">
                 {currentPlayer.isAlive && (
                    <>
                    <div className="flex w-full gap-2">
                        <Input
                            placeholder="Escribe un mensaje..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            disabled={!currentPlayer.isAlive}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSendMessage()}
                            disabled={!newMessage.trim() || !currentPlayer.isAlive}
                        >
                            <Send className="h-5 w-5" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-center">
                        {quickPhrases.map(phrase => (
                            <Button key={phrase} variant="outline" size="sm" className="text-xs" onClick={() => handleSendMessage(phrase)}>
                                {phrase}
                            </Button>
                        ))}
                    </div>
                    </>
                 )}
            </CardFooter>
        </Card>
    );
}
