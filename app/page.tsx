
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden">
      <Image
        src="/noche.png"
        alt="A mysterious, dark, misty forest at night."
        fill
        className="object-cover z-0"
        priority
      />
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      <main className="relative z-10 flex flex-col items-center text-center text-white space-y-8">
        <h1 className="font-headline text-6xl md:text-8xl font-bold tracking-tight text-shadow-lg shadow-black/50">
          El Pueblo Duerme
        </h1>
        <p className="text-lg md:text-xl text-white/80">
          Entorno configurado. El servidor está listo para recibir órdenes.
        </p>
      </main>
    </div>
  );
}
