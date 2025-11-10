
"use client";

import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Player } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Send, Heart } from 'lucide-react';
import { sendLoversChatMessage } from '@/lib/firebase-client-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getMillis } from '@/lib/utils';

interface LoversChatProps {
    gameId: string;
    currentPlayer: Player;
    messages: ChatMessage[];
}

export function LoversChat({ gameId, currentPlayer, messages }: LoversChatProps) {
    const [newMessage, setNewMessage] = useState('');
    const { toast } = useToast();
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return;
        
        const res = await sendLoversChatMessage(gameId, currentPlayer.userId, currentPlayer.displayName, newMessage);

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
        <Card className="bg-pink-900/20 border-pink-400/40 flex flex-col h-full max-h-80">
            <CardHeader className='pb-2'>
                <CardTitle className="font-headline text-pink-300 text-lg flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Chat de Enamorados
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full" ref={scrollAreaRef}>
                    <div className="p-4 space-y-3">
                        {messages.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground">La flecha de Cupido os ha unido. Podéis hablar en secreto.</p>
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
                                        isOwnMessage ? "bg-pink-600 text-white" : "bg-card"
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
            <CardFooter className="p-2 border-t border-pink-400/30">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} 
                    className="w-full flex items-center gap-2"
                >
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Susurra a tu amor..."
                        className="bg-card/50"
                    />
                    <Button type="submit" size="icon" variant="outline" className="bg-pink-600 hover:bg-pink-700" disabled={!newMessage.trim()}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}

    