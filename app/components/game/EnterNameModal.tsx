"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircle } from "lucide-react";

const FormSchema = z.object({
  displayName: z.string().min(2, "El nombre debe tener al menos 2 caracteres.").max(20, "El nombre no puede tener más de 20 caracteres."),
});

type EnterNameModalProps = {
  isOpen: boolean;
  onNameSubmit: (name: string) => void;
  error?: string | null;
};

export function EnterNameModal({ isOpen, onNameSubmit, error }: EnterNameModalProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      displayName: "",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    onNameSubmit(data.displayName);
  }

  return (
    <Dialog open={isOpen} onOpenChange={isOpen ? () => {} : undefined}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">¡Bienvenido al pueblo!</DialogTitle>
          <DialogDescription>
            Para unirte a la partida, por favor dinos cómo te llamas.
          </DialogDescription>
        </DialogHeader>
        {error && (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="Tu nombre" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">Entrar</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
