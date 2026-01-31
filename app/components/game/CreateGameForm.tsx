
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
import type { Game, GameSettings } from "@/types";
import { Checkbox } from "../ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

const roleKeys = [
  'seer', 'doctor', 'hunter', 
  'cupid', 'guardian', 'priest', 
  'prince', 'lycanthrope', 'twin', 
  'hechicera', 'wolf_cub', 'cursed',
  'cult_leader', 'fisherman', 'vampire',
  'ghost', 'virginia_woolf', 'leprosa',
  'river_siren', 'lookout', 'troublemaker'
] as const;

type RoleKey = typeof roleKeys[number];

const schemaObject = {
  gameName: z.string().min(3, "El nombre debe tener al menos 3 caracteres.").max(30, "El nombre no puede tener más de 30 caracteres."),
  displayName: z.string().min(2, "El nombre debe tener al menos 2 caracteres.").max(20, "El nombre no puede tener más de 20 caracteres."),
  maxPlayers: z.number().min(3).max(32),
  isPublic: z.boolean(),
  fillWithAI: z.boolean(),
  juryVoting: z.boolean(),
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
    isPublic: false,
    fillWithAI: false,
    juryVoting: true,
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
    wolf_cub: false,
    cursed: false,
    cult_leader: false,
    fisherman: false,
    vampire: false,
    ghost: false,
    virginia_woolf: false,
    leprosa: false,
    river_siren: false,
    lookout: false,
    troublemaker: false,
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
    
    const { gameName, displayName: playerDisplayName, maxPlayers: formMaxPlayers, isPublic, fillWithAI, juryVoting, ...roles } = data;
    
    const gameSettings: Partial<GameSettings> = { ...roles };

    const allRoleKeys: (keyof GameSettings)[] = [
      'seer', 'doctor', 'hunter', 'cupid', 'guardian', 'priest', 'prince', 'lycanthrope', 'twin', 'hechicera',
      'ghost', 'virginia_woolf', 'leprosa', 'river_siren', 'lookout', 'troublemaker', 'silencer', 'seer_apprentice',
      'elder_leader', 'resurrector_angel', 'wolf_cub', 'cursed', 'witch', 'seeker_fairy', 'shapeshifter', 'drunk_man',
      'cult_leader', 'fisherman', 'vampire', 'banshee', 'executioner', 'sleeping_fairy'
    ];
    
    allRoleKeys.forEach(key => {
        if (!(key in gameSettings)) {
            gameSettings[key] = false;
        }
    });

    const result = await createGame({
      userId,
      displayName: playerDisplayName,
      avatarUrl,
      gameName,
      maxPlayers: formMaxPlayers,
      settings: { ...gameSettings, werewolves, fillWithAI, isPublic, juryVoting } as Game['settings'],
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
            
            <div className="space-y-4 rounded-lg border p-4 bg-background/30">
              <h3 className="text-lg font-medium">Ajustes de la Partida</h3>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/50">
                      <div className="space-y-0.5">
                        <FormLabel>Partida Pública</FormLabel>
                        <FormDescription>
                          Permite que tu partida aparezca en la lista de salas públicas.
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
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/50">
                      <div className="space-y-0.5">
                        <FormLabel>Rellenar con IA</FormLabel>
                        <FormDescription>
                          Completa los puestos vacíos con jugadores IA al empezar.
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
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/50">
                      <div className="space-y-0.5">
                        <FormLabel>Voto del Jurado</FormLabel>
                        <FormDescription>
                          Permite a los jugadores muertos votar para desempatar.
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
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Roles Especiales</Label>
                <p className="text-sm text-muted-foreground">
                  Selecciona los roles que quieres incluir en la partida.
                </p>
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
