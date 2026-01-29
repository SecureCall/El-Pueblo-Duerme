
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Users, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGameSession } from "@/hooks/use-game-session";
import { createGame } from "@/lib/firebase-actions";
import { Slider } from "@/components/ui/slider";
import { roleDetails } from "@/lib/roles";
import type { GameSettings } from "@/types";
import { Checkbox } from "../ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import Image from "next/image";
import { cn } from "@/lib/utils";

const roleKeys = [
  'seer', 'doctor', 'hunter', 'cupid', 'guardian', 'priest', 'prince', 'lycanthrope', 'twin', 'hechicera'
] as const;

type RoleKey = typeof roleKeys[number];

const schemaObject = {
  gameName: z.string().min(3, "El nombre debe tener al menos 3 caracteres.").max(30, "El nombre no puede tener más de 30 caracteres."),
  displayName: z.string().min(2, "El nombre debe tener al menos 2 caracteres.").max(20, "El nombre no puede tener más de 20 caracteres."),
  maxPlayers: z.number().min(3).max(32),
  ...roleKeys.reduce((acc, key) => {
    acc[key] = z.boolean();
    return acc;
  }, {} as Record<RoleKey, z.ZodBoolean>),
};

const CreateGameSchema = z.object(schemaObject);

const defaultValues: z.infer<typeof CreateGameSchema> = {
    gameName: "Partida de Pueblo Duerme",
    displayName: "",
    maxPlayers: 8,
    seer: true,
    doctor: true,
    hunter: true,
    cupid: true,
    guardian: false,
    priest: false,
    prince: false,
    lycanthrope: false,
    twin: false,
    hechicera: false,
};

export function CreateGameForm() {
  const router = useRouter();
  const { userId, displayName, avatarUrl, isSessionLoaded } = useGameSession();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof CreateGameSchema>>({
    resolver: zodResolver(CreateGameSchema),
    defaultValues: {
      ...defaultValues,
      displayName: displayName || "",
    },
  });

  const maxPlayers = form.watch('maxPlayers');
  const werewolves = Math.max(1, Math.floor(maxPlayers / 5));

  async function onSubmit(data: z.infer<typeof CreateGameSchema>) {
    if (!isSessionLoaded || !userId || !avatarUrl) {
      toast({
        variant: "destructive",
        title: "Sesión no lista",
        description: "Por favor, espera un momento a que cargue la sesión e inténtalo de nuevo.",
      });
      return;
    }

    setIsSubmitting(true);
    
    const { gameName, displayName: playerDisplayName, maxPlayers: formMaxPlayers, ...gameSettings } = data;

    const result = await createGame({
      userId,
      displayName: playerDisplayName,
      avatarUrl,
      gameName,
      maxPlayers: formMaxPlayers,
      settings: { ...gameSettings, werewolves, fillWithAI: false, isPublic: false, juryVoting: true },
    });
    
    if (result.gameId) {
      toast({ title: "¡Partida creada!", description: `Uniéndote a la sala ${result.gameId}.` });
      router.push(`/game/${result.gameId}`);
    } else {
      toast({
        variant: "destructive",
        title: "Error al crear la partida",
        description: result.error || "Ocurrió un error inesperado.",
      });
      setIsSubmitting(false);
    }
  }

  const setAllRoles = (value: boolean) => {
    roleKeys.forEach(key => {
      form.setValue(key, value);
    });
  };

  return (
    <Card className="w-full bg-card/80 border-border/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 text-left">
            <FormField
              control={form.control}
              name="gameName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Partida</FormLabel>
                  <FormControl>
                    <Input {...field} required minLength={3} maxLength={30}/>
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tu Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} required minLength={2} maxLength={20} />
                  </FormControl>
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="maxPlayers"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Número de Jugadores ({field.value})</FormLabel>
                        <FormControl>
                            <Slider
                                min={3}
                                max={32}
                                step={1}
                                value={[field.value]}
                                onValueChange={(vals) => field.onChange(vals[0])}
                            />
                        </FormControl>
                         <FormDescription>
                            Esto incluirá {werewolves} Hombre(s) Lobo.
                        </FormDescription>
                    </FormItem>
                )}
            />
            
            <div className="space-y-4">
              <div>
                <FormLabel>Roles Especiales</FormLabel>
                <FormDescription>
                  Selecciona los roles que quieres incluir en la partida.
                </FormDescription>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setAllRoles(true)}>Seleccionar Todos</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setAllRoles(false)}>Deseleccionar Todos</Button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {roleKeys.map(roleKey => {
                  const details = roleDetails[roleKey];
                  if (!details) return null;
                  return (
                    <FormField
                      key={roleKey}
                      control={form.control}
                      name={roleKey}
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 p-2 rounded-lg bg-background/30">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              id={roleKey}
                            />
                          </FormControl>
                          <div className="relative h-8 w-8">
                             <Image src={details.image} alt={details.name} fill className="object-contain" unoptimized/>
                          </div>
                          <FormLabel htmlFor={roleKey} className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", details.color)}>
                            {details.name}
                          </FormLabel>
                           <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-pointer" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{details.description}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FormItem>
                      )}
                    />
                  );
                })}
              </div>
            </div>

            <Button type="submit" className="w-full font-bold text-lg" disabled={isSubmitting || !isSessionLoaded}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Users className="mr-2" />}
              Crear Partida
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
