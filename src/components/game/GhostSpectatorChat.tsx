
"use client";

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Player } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Send, Skull } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { sendGhostChatMessage } from '@/lib/firebase-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Timestamp } from 'firebase/firestore';

interface GhostChatProps {
    gameId: string;
    currentPlayer: Player;
    messages: ChatMessage[];
}

const GHOST_QUICK_MESSAGES = [
    "¡Estoy muerto!",
    "Vi al lobo...",
    "¡Fue {player}!",
    "Susurros desde el más allá...",
];

export default function GhostSpectatorChat({ gameId, currentPlayer, messages }: GhostChatProps) {
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
            // Future sound effect can go here
        }
        lastMessageCount.current = messages.length;
    }, [messages]);

    const handleSendMessage = async (text?: string) => {
        const messageText = text || newMessage;
        if (!messageText.trim() || !firestore) return;
        
        const res = await sendGhostChatMessage(firestore, gameId, currentPlayer.userId, currentPlayer.displayName, messageText);

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
                description: res.error || 'No se pudo enviar el mensaje fantasma.',
            });
        }
    };

    const handleQuickMessage = (template: string) => {
        handleSendMessage(template);
    };
    
    const getDateFromTimestamp = (timestamp: Timestamp | { seconds: number; nanoseconds: number; } | string) => {
        if (!timestamp) return new Date();
        if (typeof timestamp === 'string') {
            return new Date(timestamp);
        }
        if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }
        return new Date(timestamp.seconds * 1000);
    }

    const canChat = !currentPlayer.isAlive; 

    return (
        <Card className="bg-gray-900/80 border-gray-700/50 flex flex-col h-full">
            <CardHeader>
                <CardTitle className="font-headline text-gray-300 flex items-center gap-2"><Skull className="h-5 w-5" /> Chat de los Espíritus</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full" ref={scrollAreaRef}>
                    <div className="p-6 space-y-4">
                        {messages.length === 0 ? (
                            <p className="text-center text-gray-500">Los espíritus aún no han hablado...</p>
                        ) : (
                            messages.map((msg, index) => {
                                const isOwnMessage = msg.senderId === currentPlayer.userId;
                                return (
                                <div key={msg.id || index} className={cn(
                                    "flex flex-col",
                                    isOwnMessage ? "items-end" : "items-start"
                                )}>
                                    <div className={cn(
                                        "rounded-lg px-3 py-2 max-w-xs relative",
                                        isOwnMessage ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-200"
                                    )}>
                                        <p className="font-bold text-sm">{msg.senderName}</p>
                                        <p className="text-base break-words">{msg.text}</p>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formatDistanceToNow(getDateFromTimestamp(msg.createdAt), { addSuffix: true, locale: es })}
                                    </p>
                                </div>
                            )})
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className="pt-4 border-t border-gray-700 flex-col items-start gap-2">
                <div className="flex flex-wrap gap-2">
                    {GHOST_QUICK_MESSAGES.map(msg => (
                        <Button 
                            key={msg}
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleQuickMessage(msg)}
                            disabled={!canChat}
                            className="bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-600"
                        >
                            {msg.split(' ').slice(0, 2).join(' ')}...
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
                        placeholder={canChat ? "Susurra desde el más allá..." : "Solo puedes observar..."}
                        disabled={!canChat}
                        className="bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
                    />
                    <Button type="submit" size="icon" disabled={!canChat || !newMessage.trim()} className="bg-indigo-600 hover:bg-indigo-700">
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}
