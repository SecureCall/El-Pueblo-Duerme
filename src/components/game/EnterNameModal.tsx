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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const FormSchema = z.object({
  displayName: z.string().min(2, "El nombre debe tener al menos 2 caracteres.").max(20),
});

type EnterNameModalProps = {
  isOpen: boolean;
  onNameSubmit: (name: string) => void;
};

export function EnterNameModal({ isOpen, onNameSubmit }: EnterNameModalProps) {
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
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[425px]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">¡Bienvenido al pueblo!</DialogTitle>
          <DialogDescription>
            Para unirte a la partida, por favor dinos cómo te llamas.
          </DialogDescription>
        </DialogHeader>
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
