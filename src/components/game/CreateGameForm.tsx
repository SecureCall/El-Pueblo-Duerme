"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

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

const FormSchema = z.object({
  gameName: z.string().min(3, { message: "El nombre de la partida debe tener al menos 3 caracteres." }).max(30),
  displayName: z.string().min(2, { message: "Tu nombre debe tener al menos 2 caracteres." }).max(20),
  maxPlayers: z.number().min(4).max(20),
  fillWithAI: z.boolean(),
});

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
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsSubmitting(true);
    setDisplayName(data.displayName);
    const response = await createGame(
      userId,
      data.displayName,
      data.gameName,
      data.maxPlayers,
      data.fillWithAI
    );
    
    if (response.gameId) {
      router.push(`/game/${response.gameId}`);
    } else {
      toast({
        variant: "destructive",
        title: "Error al crear la partida",
        description: "Hubo un problema al crear la partida. Por favor, inténtalo de nuevo.",
      });
      setIsSubmitting(false);
    }
  }

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
                      min={4}
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
      </CardContent>
    </Card>
  );
}
