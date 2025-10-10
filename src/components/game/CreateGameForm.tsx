
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HelpCircle, Loader2 } from "lucide-react";
import Image from "next/image";


import { useGameSession } from "@/hooks/use-game-session";
import { createGame } from "@/app/actions";
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


const FormSchema = z.object({
  gameName: z.string().min(3, { message: "El nombre de la partida debe tener al menos 3 caracteres." }).max(30),
  displayName: z.string().min(2, { message: "Tu nombre debe tener al menos 2 caracteres." }).max(20),
  maxPlayers: z.number().min(3).max(20),
  fillWithAI: z.boolean(),
  // Roles base
  seer: z.boolean(),
  doctor: z.boolean(),
  hunter: z.boolean(),
  cupid: z.boolean(),
  hechicera: z.boolean(),
  lycanthrope: z.boolean(),
  prince: z.boolean(),
  twin: z.boolean(),
  guardian: z.boolean(),
  priest: z.boolean(),
  wolf_cub: z.boolean(),
  cursed: z.boolean(),
  // Roles adicionales
  great_werewolf: z.boolean(),
  white_werewolf: z.boolean(),
  scapegoat: z.boolean(),
  savior: z.boolean(),
  ancient: z.boolean(),
  fool: z.boolean(),
  angel: z.boolean(),
  thief: z.boolean(),
  wild_child: z.boolean(),
  piper: z.boolean(),
  pyromaniac: z.boolean(),
  judge: z.boolean(),
  raven: z.boolean(),
  knight: z.boolean(),
  fox: z.boolean(),
  bear_trainer: z.boolean(),
  two_sisters: z.boolean(),
  three_brothers: z.boolean(),
  actor: z.boolean(),
});

const specialRoles: Exclude<NonNullable<PlayerRole>, 'villager' | 'werewolf'>[] = [
    'seer', 'doctor', 'hunter', 'cupid', 'hechicera', 'lycanthrope', 'prince', 
    'twin', 'guardian', 'priest', 'wolf_cub', 'cursed', 'great_werewolf', 
    'white_werewolf', 'scapegoat', 'savior', 'ancient', 'fool', 'angel', 'thief', 
    'wild_child', 'piper', 'pyromaniac', 'judge', 'raven', 'knight', 'fox', 
    'bear_trainer', 'two_sisters', 'three_brothers', 'actor'
];


export function CreateGameForm() {
  const router = useRouter();
  const { userId, displayName, setDisplayName } = useGameSession();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      gameName: "Partida de Pueblo Duerme",
      displayName: displayName || "",
      maxPlayers: 8,
      fillWithAI: true,
      // Default enabled roles
      seer: true,
      doctor: true,
      hunter: true,
      cupid: true,
      hechicera: true,
      guardian: true,
      // Default disabled roles
      lycanthrope: false,
      prince: false,
      twin: false,
      priest: false,
      wolf_cub: false,
      cursed: false,
      great_werewolf: false,
      white_werewolf: false,
      scapegoat: false,
      savior: false,
      ancient: false,
      fool: false,
      angel: false,
      thief: false,
      wild_child: false,
      piper: false,
      pyromaniac: false,
      judge: false,
      raven: false,
      knight: false,
      fox: false,
      bear_trainer: false,
      two_sisters: false,
      three_brothers: false,
      actor: false,
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsSubmitting(true);
    setDisplayName(data.displayName);

    const { gameName, displayName: pName, maxPlayers, fillWithAI, ...roles } = data;

    const gameSettings = {
        fillWithAI,
        werewolves: Math.max(1, Math.floor(data.maxPlayers / 5)),
        ...roles
    };
    
    const response = await createGame(
      userId,
      pName,
      gameName,
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
                    <Input {...field} />
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
                    <Input {...field} />
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
                      max={20}
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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  {specialRoles.map(roleId => {
                    const details = roleDetails[roleId];
                    if (!details) return null;
                    return (
                    <FormField
                      key={roleId}
                      control={form.control}
                      name={roleId}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 bg-background/50">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
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

            <Button type="submit" className="w-full font-bold text-lg" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Crear y Unirse"}
            </Button>
          </form>
        </Form>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
