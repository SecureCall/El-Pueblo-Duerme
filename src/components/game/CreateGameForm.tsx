
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FlaskConical, Crown, Fingerprint, Users2, Loader2, HelpCircle, Heart, Shield, Sparkles, User } from "lucide-react";


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
import { WolfIcon, HunterIcon, SeerIcon, DoctorIcon, PriestIcon, LycanthropeIcon } from "../icons";

const FormSchema = z.object({
  gameName: z.string().min(3, { message: "El nombre de la partida debe tener al menos 3 caracteres." }).max(30),
  displayName: z.string().min(2, { message: "Tu nombre debe tener al menos 2 caracteres." }).max(20),
  maxPlayers: z.number().min(3).max(20),
  fillWithAI: z.boolean(),
  // Roles
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
});

const specialRoles = [
  { id: 'seer', label: 'Vidente', Icon: SeerIcon, description: 'Descubre el rol de un jugador cada noche.' },
  { id: 'doctor', label: 'Doctor', Icon: DoctorIcon, description: 'Protege a un jugador del ataque de los lobos. No puede curar a la misma persona 2 noches seguidas.' },
  { id: 'hechicera', label: 'Hechicera', Icon: FlaskConical, description: 'Usa una poción de vida y una de muerte.' },
  { id: 'hunter', label: 'Cazador', Icon: HunterIcon, description: 'Al morir, puede llevarse a otro jugador consigo.' },
  { id: 'prince', label: 'Príncipe', Icon: Crown, description: 'Inmune a ser linchado por votación.' },
  { id: 'lycanthrope', label: 'Licántropo', Icon: LycanthropeIcon, description: 'Un aldeano que la vidente ve como lobo.' },
  { id: 'twin', label: 'Gemelas', Icon: Users2, description: 'Dos jugadores que se conocen y son aliados.' },
  { id: 'cupid', label: 'Cupido', Icon: Heart, description: 'Enamora a dos jugadores la primera noche.' },
  { id: 'guardian', label: 'Guardián', Icon: Shield, description: 'Protege a un jugador del ataque de los lobos. No puede protegerse a sí mismo.' },
  { id: 'priest', label: 'Sacerdote', Icon: PriestIcon, description: 'Bendice a un jugador, protegiéndolo de cualquier ataque nocturno.' },
  { id: 'wolf_cub', label: 'Cría de Lobo', Icon: WolfIcon, description: 'Si muere, los lobos matan a dos la noche siguiente.' },
  { id: 'cursed', label: 'Maldito', Icon: User, description: 'Si los lobos te atacan, te conviertes en uno de ellos.' },
] as const;


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
      seer: true,
      doctor: true,
      hunter: true,
      cupid: true,
      hechicera: true,
      lycanthrope: true,
      prince: true,
      twin: true,
      guardian: true,
      priest: true,
      wolf_cub: true,
      cursed: true,
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
              <div className="grid grid-cols-2 gap-4 mt-4">
                  {specialRoles.map(role => (
                    <FormField
                      key={role.id}
                      control={form.control}
                      name={role.id}
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
                              <role.Icon className="h-4 w-4" />
                              {role.label}
                               <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{role.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                  ))}
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
