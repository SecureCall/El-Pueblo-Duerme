
"use client";

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Game, Player } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Send, AlertTriangle, MicOff } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { sendChatMessage } from '@/lib/firebase-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { playSoundEffect } from '@/lib/sounds';
import { getMillis } from '@/lib/utils';

interface GameChatProps {
    gameId: string;
    phase: Game['phase'];
    silencedPlayerId: string | null;
    currentPlayer: Player;
    messages: ChatMessage[];
    players: Player[];
}

const QUICK_MESSAGES = [
    "¡Soy un simple aldeano!",
    "Tengo mis sospechas...",
    "Votemos por {player}",
    "No confío en {player}",
    "La vidente debería guiarnos.",
    "El doctor salvó a alguien anoche.",
    "Esto es un caos.",
];

export function GameChat({ gameId, phase, silencedPlayerId, currentPlayer, messages, players }: GameChatProps) {
    const [newMessage, setNewMessage] = useState('');
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const lastMessageCount = useRef(messages.length);

    useEffect(() => {
        if (scrollAreaRef.current) {
            const isScrolledToBottom = scrollAreaRef.current.scrollHeight - scrollAreaRef.current.clientHeight <= scrollAreaRef.current.scrollTop + 1;
            if (isScrolledToBottom) {
                 setTimeout(() => {
                    scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
                }, 100);
            }
        }
        
        if (messages.length > lastMessageCount.current) {
            const latestMessage = messages[messages.length - 1];
            if (latestMessage && latestMessage.senderId !== currentPlayer.userId) {
                playSoundEffect('/audio/effects/chat-pop.mp3');
            }
            if (latestMessage && latestMessage.mentionedPlayerIds?.includes(currentPlayer.userId)) {
                toast({
                    title: `¡Te han mencionado!`,
                    description: `${latestMessage.senderName}: "${latestMessage.text}"`,
                });
            }
        }
        lastMessageCount.current = messages.length;

    }, [messages, currentPlayer.userId, toast]);

    const handleSendMessage = async (text?: string) => {
        const messageText = text || newMessage;
        if (!messageText.trim() || !firestore) return;
        
        const res = await sendChatMessage(firestore, gameId, currentPlayer.userId, currentPlayer.displayName, messageText);

        if (res.success) {
            setNewMessage('');
             if (scrollAreaRef.current) {
                setTimeout(() => {
                    scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
                }, 100);
            }
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: res.error || 'No se pudo enviar el mensaje.',
            });
        }
    };
    
    const handleQuickMessage = (template: string) => {
        if (template.includes("{player}")) {
            const alivePlayers = players.filter(p => p.isAlive && p.userId !== currentPlayer.userId);
            if(alivePlayers.length > 0) {
                const randomPlayer = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
                handleSendMessage(template.replace("{player}", randomPlayer.displayName));
            } else {
                 toast({ description: "No hay nadie más a quien mencionar." });
            }
        } else {
            handleSendMessage(template);
        }
    };

    const isSilenced = phase === 'day' && silencedPlayerId === currentPlayer.userId;
    const canChat = currentPlayer.isAlive && !isSilenced;
    
    return (
        <Card className="bg-card/80 flex flex-col h-full">
            <CardHeader>
                <CardTitle className="font-headline">Chat del Pueblo</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full" ref={scrollAreaRef}>
                    <div className="p-6 space-y-4">
                        {messages.length === 0 ? (
                            <p className="text-center text-muted-foreground">El debate comienza... El silencio puede ser sospechoso.</p>
                        ) : (
                            messages.map((msg, index) => {
                                const isOwnMessage = msg.senderId === currentPlayer.userId;
                                const isMentioned = msg.mentionedPlayerIds?.includes(currentPlayer.userId);

                                return (
                                <div key={msg.id || index} className={cn(
                                    "flex flex-col",
                                    isOwnMessage ? "items-end" : "items-start"
                                )}>
                                    <div className={cn(
                                        "rounded-lg px-3 py-2 max-w-xs relative",
                                        isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted",
                                        isMentioned && "ring-2 ring-yellow-400"
                                    )}>
                                        {isMentioned && (
                                             <AlertTriangle className="absolute -top-2 -left-2 h-4 w-4 text-yellow-300 bg-background rounded-full" />
                                        )}
                                        <p className="font-bold text-sm">{msg.senderName}</p>
                                        <p className="text-base break-words">{msg.text}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(getMillis(msg.createdAt)), { addSuffix: true, locale: es })}
                                    </p>
                                </div>
                            )})
                        )}
                         {isSilenced && (
                            <div className="flex items-center justify-center gap-2 p-4 text-destructive">
                                <MicOff className="h-5 w-5"/>
                                <p className="font-semibold">Has sido silenciado/a. No puedes hablar.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className="pt-4 border-t flex-col items-start gap-2">
                 <div className="flex flex-wrap gap-2">
                    {QUICK_MESSAGES.map(msg => (
                        <Button 
                            key={msg}
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleQuickMessage(msg)}
                            disabled={!canChat}
                        >
                            {msg.split(' ')[0]} {msg.split(' ')[1]}...
                        </Button>
                    ))}
                </div>
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
                    className="w-full flex items-center gap-2"
                >
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={
                            isSilenced 
                            ? "¡Silenciado! No puedes escribir." 
                            : canChat 
                            ? "Escribe tu mensaje..." 
                            : "Los muertos no hablan..."
                        }
                        disabled={!canChat}
                    />
                    <Button type="submit" size="icon" disabled={!canChat || !newMessage.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}

    