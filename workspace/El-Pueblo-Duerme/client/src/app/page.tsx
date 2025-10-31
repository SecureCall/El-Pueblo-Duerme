import { CreateRoom } from "@/components/CreateRoom";

export default function HomePage() {
  return (
    <div className="text-center space-y-8">
      <h1 className="text-6xl md:text-8xl font-bold tracking-tighter font-serif text-shadow-lg">
        El Pueblo Duerme
      </h1>
      <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-300">
        Una noche más cae sobre el pueblo. Entre vosotros se esconden lobos.
        ¿Podréis descubrirlos antes de que sea tarde?
      </p>
      <CreateRoom />
    </div>
  );
}
