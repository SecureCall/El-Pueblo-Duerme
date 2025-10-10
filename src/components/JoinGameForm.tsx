
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";

import { useGameSession } from "@/hooks/use-game-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "./ui/card";

// Define a simple interface for the form data without Zod
interface JoinGameFormValues {
  gameId: string;
  displayName: string;
}

export function JoinGameForm() {
  const router = useRouter();
  const { displayName, setDisplayName } = useGameSession();

  const form = useForm<JoinGameFormValues>({
    defaultValues: {
      gameId: "",
      displayName: displayName || "",
    },
  });

  const onSubmit: SubmitHandler<JoinGameFormValues> = (data) => {
    // Basic validation
    if (data.gameId.trim().length !== 5) {
      form.setError("gameId", { type: "manual", message: "El ID debe tener 5 caracteres." });
      return;
    }
    if (data.displayName.trim().length < 2 || data.displayName.trim().length > 20) {
      form.setError("displayName", { type: "manual", message: "El nombre debe tener entre 2 y 20 caracteres." });
      return;
    }

    setDisplayName(data.displayName);
    router.push(`/game/${data.gameId.toUpperCase()}`);
  };

  return (
    <Card className="bg-card/80 border-border/50 backdrop-blur-sm w-full">
        <CardContent className="p-6">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                control={form.control}
                name="gameId"
                render={({ field }) => (
                    <FormItem>
                    <FormControl>
                        <Input 
                          placeholder="ID de la partida" 
                          {...field} 
                          className="text-center text-lg tracking-widest uppercase"
                          maxLength={5}
                          required
                        />
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
                    <FormControl>
                        <Input 
                          placeholder="Tu nombre" 
                          {...field} 
                          className="text-center text-lg"
                          minLength={2}
                          maxLength={20}
                          required
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <Button type="submit" className="w-full font-bold text-lg" variant="secondary">
                    Unirse a la Partida
                </Button>
            </form>
            </Form>
        </CardContent>
    </Card>
  );
}
