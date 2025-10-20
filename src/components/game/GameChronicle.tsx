

"use client";

import type { GameEvent } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ScrollText, SunIcon, MoonIcon, Swords, Milestone, Repeat, BrainCircuit, Ghost } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { getMillis } from '@/lib/utils';
import type { Timestamp } from 'firebase/firestore';

interface GameChronicleProps {
  currentPlayerId: string;
  events: GameEvent[];
}

function getEventIcon(type: GameEvent['type']) {
    switch (type) {
        case 'night_result':
            return <MoonIcon className="h-4 w-4 text-blue-400" />;
        case 'vote_result':
            return <SunIcon className="h-4 w-4 text-yellow-400" />;
        case 'lover_death':
        case 'hunter_shot':
            return <Swords className="h-4 w-4 text-destructive" />;
        case 'player_transformed':
            return <Repeat className="h-4 w-4 text-orange-400" />;
        case 'game_over':
             return <Milestone className="h-4 w-4 text-yellow-500" />;
        case 'behavior_clue':
            return <BrainCircuit className="h-4 w-4 text-yellow-300" />;
        case 'special':
            return <Ghost className="h-4 w-4 text-purple-400" />;
        default:
            return <ScrollText className="h-4 w-4" />;
    }
}

export function GameChronicle({ events, currentPlayerId }: GameChronicleProps) {
  // Filter events: show all public events, and special events only if the current player is the target.
  const sortedEvents = events.filter(event => {
      if (event.type === 'special' && event.data?.targetId) {
          return event.data.targetId === currentPlayerId;
      }
      return true; // Show all other event types
  }); 

  const getDateFromTimestamp = (timestamp: Timestamp | { seconds: number; nanoseconds: number; } | string) => {
    if (!timestamp) return new Date();
    if (typeof timestamp === 'string') {
        return new Date(timestamp);
    }
    if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
    }
    // It's a plain object from JSON serialization
    return new Date(timestamp.seconds * 1000);
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <ScrollText className="h-6 w-6" />
          <span className="sr-only">Abrir Crónica</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="font-headline text-2xl">Crónica de la Partida</SheetTitle>
          <SheetDescription>
            Un resumen de los eventos que han ocurrido en el pueblo.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] w-full mt-4 pr-4">
          <div className="space-y-6">
            {sortedEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-4">
                <div className="mt-1">{getEventIcon(event.type)}</div>
                <div className="flex-1">
                  <p className="text-sm text-foreground">{event.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {`Ronda ${event.round} - ${event.createdAt ? formatDistanceToNow(getDateFromTimestamp(event.createdAt), { addSuffix: true, locale: es }) : ''}`}
                  </p>
                </div>
              </div>
            ))}
             {sortedEvents.length === 0 && (
                <p className="text-center text-muted-foreground py-8">Aún no ha ocurrido nada en el pueblo.</p>
             )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
