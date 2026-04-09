
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { Loader2, Ticket } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

const JoinGameSchema = z.object({
  gameId: z.string().trim().min(4, "El ID debe tener al menos 4 caracteres.").max(10, "El ID no puede tener más de 10 caracteres."),
});

function JoinGameFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof JoinGameSchema>>({
    resolver: zodResolver(JoinGameSchema),
    defaultValues: { gameId: "" },
  });

  // Auto-fill code from URL query param (share_target, protocol_handlers, direct links)
  useEffect(() => {
    const code = searchParams.get('code') ?? searchParams.get('gameId');
    if (code) {
      const cleaned = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      form.setValue('gameId', cleaned);
      // Auto-submit if the code looks complete (≥4 chars)
      if (cleaned.length >= 4) {
        form.handleSubmit(onSubmit)();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(data: z.infer<typeof JoinGameSchema>) {
    setIsSubmitting(true);
    const code = data.gameId.toUpperCase();
    
    try {
      const q = query(collection(db, 'games'), where('code', '==', code));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const gameId = snap.docs[0].id;
        toast({ title: "Partida encontrada", description: `Uniéndote a la sala ${code}...` });
        router.push(`/game/${gameId}`);
      } else {
        toast({
          variant: "destructive",
          title: "Partida no encontrada",
          description: "El código no es válido. Revisa el código e inténtalo de nuevo.",
        });
        setIsSubmitting(false);
      }
    } catch (error) {
       toast({
          variant: "destructive",
          title: "Error de red",
          description: "No se pudo conectar con el servidor. Revisa tu conexión.",
        });
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="gameId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID de la Partida</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="ABCDE"
                  className="text-center text-2xl tracking-widest font-mono"
                  style={{ textTransform: 'uppercase' }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full font-bold text-lg" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Ticket className="mr-2" />}
          Unirse a Partida
        </Button>
      </form>
    </Form>
  );
}


export default function JoinGamePage() {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4">
      <Image
        src="/noche.png"
        alt="A mysterious, dark, misty forest at night."
        fill
        className="object-cover z-0"
        priority
      />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      <div className="absolute top-4 left-4 z-10">
        <Link href="/" className="text-white hover:text-primary transition-colors">
          &larr; Volver al Inicio
        </Link>
      </div>
      <div className="relative z-10 w-full max-w-md">
        <Card className="bg-card/90 border-border/60">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Unirse a una Partida</CardTitle>
            <CardDescription>Introduce el ID de la sala para entrar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="flex justify-center py-4"><Loader2 className="animate-spin text-amber-400" /></div>}>
              <JoinGameFormInner />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
