
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Users, Wand2, Shield, Bot } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGameSession } from "@/hooks/use-game-session";
import { createGame } from "@/lib/firebase-actions";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { roleDetails } from "@/lib/roles";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { GameSettings } from "@/types";

const roleKeys = Object.keys(roleDetails).filter(
  (r) => r !== 'villager' && r !== 'werewolf'
) as (keyof Omit<GameSettings, 'werewolves' | 'fillWithAI' | 'isPublic' | 'juryVoting'>)[];

const schemaObject = {
  gameName: z.string().min(3, "El nombre debe tener al menos 3 caracteres.").max(30, "El nombre no puede tener más de 30 caracteres."),
  displayName: z.string().min(2, "El nombre debe tener al menos 2 caracteres.").max(20, "El nombre no puede tener más de 20 caracteres."),
  maxPlayers: z.number().min(3).max(32),
  fillWithAI: z.boolean(),
  isPublic: z.boolean(),
  juryVoting: z.boolean(),
  ...roleKeys.reduce((acc, key) => {
    acc[key] = z.boolean();
    return acc;
  }, {} as Record<keyof Omit<GameSettings, 'werewolves' | 'fillWithAI' | 'isPublic' | 'juryVoting'>, z.ZodBoolean>),
};

const CreateGameSchema = z.object(schemaObject);

const defaultValues: z.infer<typeof CreateGameSchema> = {
    gameName: "Partida de Pueblo Duerme",
    displayName: "",
    maxPlayers: 8,
    fillWithAI: false,
    isPublic: false,
    juryVoting: true,
    seer: true,
    doctor: true,
    hunter: true,
    guardian: true,
    priest: false,
    prince: false,
    lycanthrope: false,
    twin: false,
    hechicera: true,
    wolf_cub: true,
    cursed: false,
    cult_leader: false,
    fisherman: false,
    vampire: false,
    ghost: true,
    virginia_woolf: false,
    leprosa: false,
    river_siren: false,
    lookout: false,
    troublemaker: false,
    silencer: false,
    seer_apprentice: false,
    elder_leader: false,
    seeker_fairy: false,
    sleeping_fairy: false,
    shapeshifter: false,
    witch: false,
    banshee: false,
    drunk_man: false,
    resurrector_angel: false,
    cupid: true,
    executioner: false,
};

const roleGroups: Record<string, (keyof typeof defaultValues)[]> = {
    "Pueblo (Esenciales)": ['seer', 'doctor', 'hunter', 'hechicera', 'ghost'],
    "Pueblo (Avanzados)": ['guardian', 'priest', 'prince', 'lycanthrope', 'twin', 'virginia_woolf', 'leprosa', 'river_siren', 'lookout', 'troublemaker', 'silencer', 'seer_apprentice', 'elder_leader', 'resurrector_angel'],
    "Lobos (Extras)": ['wolf_cub', 'cursed', 'witch', 'seeker_fairy'],
    "Neutrales (Caos)": ['cupid', 'shapeshifter', 'drunk_man', 'cult_leader', 'fisherman', 'vampire', 'banshee', 'executioner', 'sleeping_fairy']
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
      settings: { ...gameSettings, werewolves },
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

  const RoleSwitch = ({ name, label, description }: { name: keyof typeof defaultValues, label: string, description: string }) => (
      <FormField
          control={form.control}
          name={name as any}
          render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/30">
                  <div className="space-y-0.5">
                      <FormLabel>{label}</FormLabel>
                      <FormDescription className="text-xs pr-4">
                          {description}
                      </FormDescription>
                  </div>
                  <FormControl>
                      <Switch
                          checked={field.value as boolean}
                          onCheckedChange={field.onChange}
                      />
                  </FormControl>
              </FormItem>
          )}
      />
  );

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
            
            <Accordion type="multiple" className="w-full">
              <AccordionItem value="roles">
                 <AccordionTrigger className="text-lg font-semibold">Configuración de Roles</AccordionTrigger>
                 <AccordionContent>
                    <ScrollArea className="h-72 w-full pr-4">
                        <div className="space-y-4">
                           {Object.entries(roleGroups).map(([groupName, roles]) => (
                               <div key={groupName}>
                                 <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                                     {groupName.includes("Pueblo") && <Shield size={16}/>}
                                     {groupName.includes("Lobos") && <Bot size={16}/>}
                                     {groupName.includes("Neutrales") && <Wand2 size={16}/>}
                                     {groupName}
                                 </h4>
                                 <div className="space-y-2">
                                  {roles.map(role => {
                                      const details = roleDetails[role as keyof typeof roleDetails];
                                      if (!details) return null;
                                      return <RoleSwitch key={role} name={role as any} label={details.name} description={details.description} />
                                  })}
                                  </div>
                               </div>
                           ))}
                        </div>
                    </ScrollArea>
                 </AccordionContent>
              </AccordionItem>
               <AccordionItem value="settings">
                 <AccordionTrigger className="text-lg font-semibold">Ajustes Adicionales</AccordionTrigger>
                 <AccordionContent className="space-y-4 pt-4">
                    <FormField
                      control={form.control}
                      name="isPublic"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/30">
                          <div className="space-y-0.5">
                            <FormLabel>Partida Pública</FormLabel>
                            <FormDescription>
                              Permitir que otros jugadores encuentren y se unan a tu partida.
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
                      name="fillWithAI"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/30">
                          <div className="space-y-0.5">
                            <FormLabel>Rellenar con IA</FormLabel>
                            <FormDescription>
                              Añadir jugadores IA para alcanzar el máximo de jugadores al iniciar.
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
                      name="juryVoting"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/30">
                          <div className="space-y-0.5">
                            <FormLabel>Voto del Jurado</FormLabel>
                            <FormDescription>
                              En caso de empate en la votación, los jugadores muertos deciden.
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
                 </AccordionContent>
              </AccordionItem>
            </Accordion>


            <Button type="submit" className="w-full font-bold text-lg" disabled={isSubmitting || !isSessionLoaded}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Users className="mr-2" />}
              Crear y Unirse
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
