
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { useGameSession } from "@/hooks/use-game-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";

const formSchema = z.object({
  gameId: z.string().length(5, { message: "El ID debe tener 5 caracteres." }).regex(/^[A-Z0-9]+$/, "El ID solo puede contener letras mayúsculas y números."),
  displayName: z.string().min(2, "El nombre debe tener entre 2 y 20 caracteres.").max(20, "El nombre debe tener entre 2 y 20 caracteres."),
});


export function JoinGameForm() {
  const router = useRouter();
  const { displayName, setDisplayName } = useGameSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gameId: "",
      displayName: displayName || "",
    },
  });

  useEffect(() => {
    if (displayName) {
        form.setValue("displayName", displayName);
    }
  }, [displayName, form]);

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    setDisplayName(data.displayName.trim());
    router.push(`/game/${data.gameId.toUpperCase().trim()}`);
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
                          placeholder="ID DE LA PARTIDA" 
                          {...field} 
                          className="text-center text-lg tracking-widest uppercase"
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
