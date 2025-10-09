"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { useGameSession } from "@/hooks/use-game-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "./ui/card";

const FormSchema = z.object({
  gameId: z.string().trim().min(1, { message: "El ID de la partida es requerido." }).length(5, {message: "El ID debe tener 5 caracteres."}).toUpperCase(),
  displayName: z.string().trim().min(2, { message: "El nombre debe tener al menos 2 caracteres." }).max(20, { message: "El nombre no puede tener más de 20 caracteres." }),
});

export function JoinGameForm() {
  const router = useRouter();
  const { displayName, setDisplayName } = useGameSession();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      gameId: "",
      displayName: displayName || "",
    },
  });

  const onSubmit: SubmitHandler<z.infer<typeof FormSchema>> = (data) => {
    setDisplayName(data.displayName);
    router.push(`/game/${data.gameId}`);
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
                        <Input placeholder="ID de la partida" {...field} className="text-center text-lg tracking-widest uppercase"/>
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
                        <Input placeholder="Tu nombre" {...field} className="text-center text-lg"/>
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
