'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Player } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Send, Ghost } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { sendGhostChatMessage } from '@/lib/firebase-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getMillis } from '@/lib/utils';

interface GhostSpectatorChatProps {
    gameId: string;
    currentPlayer: Player;
    messages: ChatMessage[];
}

export function GhostSpectatorChat({ gameId, currentPlayer, messages }: GhostSpectatorChatProps) {
    const [newMessage, setNewMessage] = useState('');
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !firestore) return;
        
        const res = await sendGhostChatMessage(firestore, gameId, currentPlayer.userId, currentPlayer.displayName, newMessage);

        if (res.success) {
            setNewMessage('');
        } else {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: res.error || 'No se pudo enviar el mensaje.',
            });
        }
    };
    
    return (
        <Card className="bg-blue-900/10 border-blue-400/30 flex flex-col h-full max-h-96">
            <CardHeader className='pb-2'>
                <CardTitle className="font-headline text-blue-300 text-lg flex items-center gap-2">
                    <Ghost className="h-5 w-5" />
                    Chat del Más Allá
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full" ref={scrollAreaRef}>
                    <div className="p-4 space-y-3">
                        {messages.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground">Las almas en pena susurran entre ellas...</p>
                        ) : (
                            messages.map((msg, index) => {
                                const isOwnMessage = msg.senderId === currentPlayer.userId;
                                return (
                                <div key={msg.id || index} className={cn(
                                    "flex flex-col",
                                    isOwnMessage ? "items-end" : "items-start"
                                )}>
                                    <div className={cn(
                                        "rounded-lg px-3 py-2 max-w-xs",
                                        isOwnMessage ? "bg-blue-800 text-white" : "bg-card"
                                    )}>
                                        <p className="font-bold text-sm">{msg.senderName}</p>
                                        <p className="text-base break-words">{msg.text}</p>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {formatDistanceToNow(new Date(getMillis(msg.createdAt)), { addSuffix: true, locale: es })}
                                    </p>
                                </div>
                            )})
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
            <CardFooter className="p-2 border-t border-blue-400/30">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
                    className="w-full flex items-center gap-2"
                >
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Susurra a los otros espectros..."
                        className="bg-card/50"
                    />
                    <Button type="submit" size="icon" variant="ghost" className="hover:bg-blue-800" disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}
