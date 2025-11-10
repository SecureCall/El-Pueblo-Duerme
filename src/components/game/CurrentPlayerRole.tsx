
"use client";

import type { Player } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Info } from "lucide-react";
import { roleDetails, defaultRoleDetail } from "@/lib/roles";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface CurrentPlayerRoleProps {
  player: Player;
}

export function CurrentPlayerRole({ player }: CurrentPlayerRoleProps) {
  if (!player.role) return null;

  const details = roleDetails[player.role] ?? defaultRoleDetail;

  return (
    <Sheet>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-2 p-2 pr-3 rounded-full bg-card/80 border border-border/50 backdrop-blur-sm shadow-lg">
          <div className="relative h-10 w-10">
             <Image 
                src={details.image} 
                alt={details.name}
                fill
                className="object-contain rounded-full bg-background/50 p-1"
                unoptimized
            />
          </div>
          <span className={cn("font-bold text-white", details.color)}>{details.name}</span>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
              <Info className="h-4 w-4" />
              <span className="sr-only">Ver información del rol</span>
            </Button>
          </SheetTrigger>
        </div>
      </div>

      <SheetContent side="bottom">
        <SheetHeader className="text-center">
          <SheetTitle className={cn("font-headline text-4xl", details.color)}>
            {details.name}
          </SheetTitle>
           <SheetDescription className="text-lg italic text-primary-foreground/80">
            {details.atmosphere}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 p-4 max-w-2xl mx-auto">
             <div className="relative h-32 w-32 flex-shrink-0">
                <Image 
                    src={details.image} 
                    alt={details.name}
                    fill
                    className="object-contain"
                    unoptimized
                />
            </div>
            <p className="text-base text-muted-foreground text-center md:text-left">
                {details.description}
            </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

    