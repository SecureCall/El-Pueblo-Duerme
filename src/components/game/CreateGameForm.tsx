
"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { HelpCircle, Loader2 } from "lucide-react";
import Image from "next/image";


import { useGameSession } from "@/hooks/use-game-session";
import { createGame } from "@/lib/firebase-actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "../ui/card";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import type { PlayerRole } from "@/types";
import { roleDetails } from "@/lib/roles";
import { useFirebase } from "@/firebase";

// Define an interface for the form values without Zod
interface CreateGameFormValues {
  gameName: string;
  displayName: string;
  maxPlayers: number;
  fillWithAI: boolean;
  isPublic: boolean;
  seer: boolean;
  doctor: boolean;
  hunter: boolean;
  cupid: boolean;
  guardian: boolean;
  priest: boolean;
  prince: boolean;
  lycanthrope: boolean;
  twin: boolean;
  hechicera: boolean;
  wolf_cub: boolean;
  cursed: boolean;
  cult_leader: boolean;
  fisherman: boolean;
  vampire: boolean;
  ghost: boolean;
  virginia_woolf: boolean;
  leprosa: boolean;
  river_siren: boolean;
  lookout: boolean;
  troublemaker: boolean;
  silencer: boolean;
  seer_apprentice: boolean;
  elder_leader: boolean;
  seeker_fairy: boolean;
  sleeping_fairy: boolean;
  shapeshifter: boolean;
  witch: boolean;
  banshee: boolean;
  drunk_man: boolean;
  resurrector_angel: boolean;
  executioner: boolean;
}

const implementedRoles: Exclude<NonNullable<PlayerRole>, 'villager' | 'werewolf'>[] = [
    'seer', 'doctor', 'hunter', 'cupid', 'guardian', 'priest', 'prince', 'lycanthrope', 'twin', 
    'hechicera', 'wolf_cub', 'cursed', 'cult_leader', 'fisherman', 'vampire', 'ghost', 'virginia_woolf',
    'leprosa', 'river_siren', 'lookout', 'troublemaker', 'silencer', 'seer_apprentice',
    'elder_leader', 'seeker_fairy', 'sleeping_fairy', 'shapeshifter', 'witch', 'banshee', 'drunk_man',
    'resurrector_angel', 'executioner'
];

export function CreateGameForm() {
  const router = useRouter();
  const { userId, displayName, setDisplayName, avatarUrl, isSessionLoaded } = useGameSession();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateGameFormValues>({
    defaultValues: {
      gameName: "Partida de Pueblo Duerme",
      displayName: displayName || "",
      maxPlayers: 8,
      fillWithAI: true,
      isPublic: false,
      seer: true,
      doctor: true,
      hunter: true,
      cupid: true,
      hechicera: true,
      guardian: true,
      prince: true,
      lycanthrope: true,
      twin: true,
      wolf_cub: true,
      cursed: true,
      cult_leader: true,
      fisherman: true,
      vampire: true,
      ghost: true,
      virginia_woolf: true,
      leprosa: true,
      river_siren: true,
      lookout: true,
      troublemaker: true,
      silencer: true,
      seer_apprentice: true,
      elder_leader: true,
      seeker_fairy: true,
      sleeping_fairy: true,
      shapeshifter: true,
      witch: true,
      banshee: true,
      drunk_man: true,
      resurrector_angel: true,
      executioner: true,
    },
  });
  
  useEffect(() => {
    if (displayName) {
      form.setValue('displayName', displayName);
    }
  }, [displayName, form]);

  const selectAllRoles = (select: boolean) => {
    implementedRoles.forEach(roleId => {
      form.setValue(roleId, select);
    });
  };

  async function onSubmit(data: CreateGameFormValues) {
    if (!isSessionLoaded || !userId || !firestore || !avatarUrl) {
        toast({
            variant: "destructive",
            title: "Esperando sesión",
            description: "Por favor, espera un momento mientras iniciamos tu sesión y avatar.",
        });
        return;
    }
    
    const trimmedGameName = data.gameName.trim();
    const trimmedDisplayName = data.displayName.trim();

    if (!trimmedDisplayName) {
        form.setError("displayName", { type: "manual", message: "Tu nombre no puede estar vacío." });
        return;
    }
    if (!trimmedGameName) {
        form.setError("gameName", { type: "manual", message: "El nombre de la partida no puede estar vacío." });
        return;
    }

    setIsSubmitting(true);
    setDisplayName(trimmedDisplayName);

    const { maxPlayers, fillWithAI, isPublic, ...roles } = data;

    // Filter for only the roles settings
    const roleSettings = implementedRoles.reduce((acc, roleId) => {
        acc[roleId] = !!roles[roleId];
        return acc;
    }, {} as Record<Exclude<NonNullable<PlayerRole>, 'villager' | 'werewolf'>, boolean>);


    const gameSettings = {
        fillWithAI,
        isPublic,
        werewolves: 1, // This can be adjusted later based on rules
        ...roleSettings
    };
    
    const response = await createGame(
      firestore,
      userId,
      trimmedDisplayName,
      avatarUrl,
      trimmedGameName,
      maxPlayers,
      gameSettings
    );
    
    if (response.gameId) {
      router.push(`/game/${response.gameId}`);
    } else {
      toast({
        variant: "destructive",
        title: "Error al crear la partida",
        description: response.error || "Hubo un problema al crear la partida. Por favor, inténtalo de nuevo.",
      });
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full bg-card/80 border-border/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <TooltipProvider>
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
                  <FormMessage />
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
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maxPlayers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Jugadores: {field.value}</FormLabel>
                  <FormControl>
                    <Slider
                      min={3}
                      max={32}
                      step={1}
                      defaultValue={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <Label className="text-base">Roles Especiales</Label>
              <FormDescription>Selecciona los roles que quieres incluir en la partida.</FormDescription>
              <div className="flex gap-2 mt-2 mb-4">
                  <Button type="button" variant="outline" size="sm" onClick={() => selectAllRoles(true)}>
                      Seleccionar Todos
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => selectAllRoles(false)}>
                      Deseleccionar Todos
                  </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {implementedRoles.map(roleId => {
                    const details = roleDetails[roleId];
                    if (!details) return null;
                    return (
                    <FormField
                      key={roleId}
                      control={form.control}
                      name={roleId as keyof CreateGameFormValues}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 bg-background/50">
                          <FormControl>
                            <Checkbox
                              checked={field.value as boolean}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="flex items-center gap-2">
                               <div className="relative h-6 w-6">
                                <Image src={details.image} alt={details.name} fill className="object-contain" unoptimized />
                               </div>
                              {details.name}
                               <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{details.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  )})}
              </div>
            </div>

            <FormField
              control={form.control}
              name="fillWithAI"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/50">
                  <div className="space-y-0.5">
                    <FormLabel>Llenar con IA</FormLabel>
                    <FormDescription>
                      Rellena los huecos con bots si no se unen suficientes jugadores.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/50">
                  <div className="space-y-0.5">
                    <FormLabel>Partida Pública</FormLabel>
                    <FormDescription>
                      Permite que otros jugadores encuentren y se unan a tu partida.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full font-bold text-lg" disabled={isSubmitting || !isSessionLoaded}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Crear y Unirse"}
            </Button>
          </form>
        </Form>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
