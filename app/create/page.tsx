'use client';

import { CreateGameForm } from "@/components/game/CreateGameForm";
import Link from "next/link";
import { PageAudio } from "@/components/audio/PageAudio";

export default function CreateGamePage() {
  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center p-4"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <PageAudio track="lobby" />
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(5, 10, 20, 0.82)' }} />
      <div className="absolute top-4 left-4 z-10">
        <Link href="/" className="text-white hover:text-primary transition-colors">
          &larr; Volver al Inicio
        </Link>
      </div>
      <div className="relative z-10 w-full max-w-lg py-10">
        <h1 className="text-center font-headline text-5xl font-bold text-white mb-2">
          Crear Partida
        </h1>
        <p className="text-center text-white/50 text-sm mb-8">
          Configura las reglas de tu nueva partida y réune a tus amigos.
        </p>
        <CreateGameForm />
      </div>
    </div>
  );
}
