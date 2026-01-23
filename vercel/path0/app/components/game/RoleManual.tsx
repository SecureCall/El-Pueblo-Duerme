
"use client";

import type { Game } from '@/types';
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
import { BookOpen } from 'lucide-react';
import { roleDetails } from '@/lib/roles';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface RoleManualProps {
  settings: Game['settings'];
}

export function RoleManual({ settings }: RoleManualProps) {
  const activeRoles = Object.keys(roleDetails).filter(roleKey => {
    if (roleKey === 'villager' || roleKey === 'werewolf') return true;
    return settings[roleKey as keyof typeof settings];
  });
  
  const villageTeam = activeRoles.filter(r => roleDetails[r as keyof typeof roleDetails]?.team === 'Aldeanos');
  const wolfTeam = activeRoles.filter(r => roleDetails[r as keyof typeof roleDetails]?.team === 'Lobos');
  const neutralTeam = activeRoles.filter(r => roleDetails[r as keyof typeof roleDetails]?.team === 'Neutral');

  const RoleSection = ({ title, roles, teamColor }: { title: string, roles: string[], teamColor: string }) => (
    <div className="mb-6">
      <h3 className={cn("text-2xl font-headline font-bold mb-2", teamColor)}>{title}</h3>
      <Accordion type="single" collapsible className="w-full">
        {roles.map((roleKey) => {
          const details = roleDetails[roleKey as keyof typeof roleDetails];
          if (!details) return null;
          return (
            <AccordionItem value={details.name} key={details.name}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-4">
                    <div className="relative h-10 w-10">
                        <Image
                            src={details.image}
                            alt={details.name}
                            fill
                            className="object-contain"
                            unoptimized
                        />
                    </div>
                    <span className={cn("text-xl font-bold", details.color)}>{details.name}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground pl-16">
                {details.description}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <BookOpen className="h-6 w-6" />
          <span className="sr-only">Abrir Manual de Roles</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="font-headline text-2xl">Manual de Roles en Juego</SheetTitle>
          <SheetDescription>
            Estos son los roles activos en esta partida.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] w-full mt-4 pr-4">
            {villageTeam.length > 0 && <RoleSection title="El Pueblo" roles={villageTeam} teamColor="text-blue-400" />}
            {wolfTeam.length > 0 && <RoleSection title="Los Lobos" roles={wolfTeam} teamColor="text-destructive" />}
            {neutralTeam.length > 0 && <RoleSection title="Roles Neutrales" roles={neutralTeam} teamColor="text-purple-400" />}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
