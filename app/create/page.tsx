
import { CreateGameForm } from "@/components/game/CreateGameForm";
import Link from "next/link";

export default function CreateGamePage() {
  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center p-4"
      style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(5, 10, 20, 0.82)' }} />
      <div className="absolute top-4 left-4 z-10">
        <Link href="/" className="text-white hover:text-primary transition-colors">
          &larr; Volver al Inicio
        </Link>
      </div>
      <div className="relative z-10 w-full max-w-4xl">
        <h1 className="text-center font-headline text-5xl font-bold text-white text-shadow-lg mb-8">
          Configura tu Partida
        </h1>
        <CreateGameForm />
      </div>
    </div>
  );
}
