
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./components/ui/card";
import { AlertTriangle } from "lucide-react";
import { GameMusic } from './components/game/GameMusic';
import Image from "next/image";
import { PlaceHolderImages } from "./lib/placeholder-images";

export default function NotFoundPage() {
  const bgImage = PlaceHolderImages.find((img) => img.id === 'game-bg-night');

  return (
    <>
      <GameMusic src="/audio/menu-theme.mp3" />
      <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 overflow-hidden">
        {bgImage && (
            <Image
                src={bgImage.imageUrl}
                alt={bgImage.description}
                fill
                className="object-cover z-0"
                data-ai-hint={bgImage.imageHint}
                priority
            />
        )}
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
        <main className="relative z-10 w-full max-w-3xl">
          <Card className="w-full bg-destructive/10 border-destructive text-destructive-foreground">
            <CardHeader>
              <CardTitle className="font-headline text-3xl flex items-center gap-4">
                <AlertTriangle className="h-8 w-8" />
                ATENCIÓN: ENTORNO DE EJECUCIÓN NO COMPATIBLE
              </CardTitle>
              <CardDescription className="text-destructive-foreground/80 text-lg pt-2">
                El error 404 es un síntoma de que este proyecto no puede compilarse ni ejecutarse en este entorno de desarrollo en línea.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-base space-y-4">
                <p>
                    Debido a un error persistente (`ENOTEMPTY`) de esta plataforma, el servidor de Next.js no puede construir las páginas correctamente. 
                </p>
                <p className="font-bold text-lg text-primary-foreground">
                    Ningún cambio en el código solucionará este problema aquí. La única solución es ejecutarlo localmente.
                </p>
                <div>
                  <h3 className="font-bold text-xl mb-2">Pasos para Ejecutar Localmente</h3>
                  <ol className="list-decimal list-inside space-y-2 bg-background/20 p-4 rounded-md border">
                      <li>**Descargar el Proyecto:** Descargue todos los archivos de la aplicación a una carpeta en su ordenador.</li>
                      <li>**Abrir un Terminal:** Navegue hasta la carpeta del proyecto en su línea de comandos.</li>
                      <li>**Instalar Dependencias:** Ejecute el comando `npm install`.</li>
                      <li>**Iniciar el Servidor:** Ejecute el comando `npm run dev`.</li>
                  </ol>
                </div>
                <p>
                    Una vez iniciado, abra `http://localhost:9002` en su navegador para ver la aplicación funcionando como se espera. Consulte el archivo `README.md` para más detalles.
                </p>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
