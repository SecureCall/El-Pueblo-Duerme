
"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGameSession } from "@/hooks/use-game-session";

interface CreateGameFormValues {
  gameName: string;
  displayName: string;
}

export function CreateGameForm() {
  const router = useRouter();
  const { userId, displayName, setDisplayName, avatarUrl, isSessionLoaded } = useGameSession();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateGameFormValues>({
    defaultValues: {
      gameName: "Partida de Pueblo Duerme",
      displayName: displayName || "",
    },
  });

  async function onSubmit(data: CreateGameFormValues) {
    if (!isSessionLoaded || !userId) {
      toast({
            variant: "destructive",
            title: "Sesión no lista",
            description: "Por favor, espera un momento a que cargue la sesión e inténtalo de nuevo.",
        });
      return;
    }
    // TODO: Call a server action to create the game
    toast({
        variant: "destructive",
        title: "En construcción",
        description: "La creación de partidas aún no está implementada.",
    });
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
            <Button type="submit" className="w-full font-bold text-lg" disabled={isSubmitting || !isSessionLoaded}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Crear y Unirse"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
