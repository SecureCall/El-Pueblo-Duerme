export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground py-12">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-bold font-headline mb-8 text-center text-primary">Términos de Servicio</h1>
        
        <div className="bg-card/80 rounded-lg shadow-lg p-8 space-y-6 border border-border/50">
          <section>
            <h2 className="text-2xl font-semibold mb-3 text-primary-foreground">1. Aceptación de los Términos</h2>
            <p className="text-muted-foreground">
              Al acceder y usar "El Pueblo Duerme", aceptas estos términos. Si no estás de acuerdo, no uses el servicio.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3 text-primary-foreground">2. Uso Aceptable</h2>
            <p className="text-muted-foreground">Está prohibido:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-muted-foreground">
              <li>Usar exploits, trampas o hacks</li>
              <li>Crear múltiples cuentas para ventaja injusta</li>
              <li>Acosar, amenazar o discriminar a otros jugadores</li>
              <li>Compartir contenido ofensivo o ilegal</li>
              <li>Intentar acceder a cuentas ajenas</li>
              <li>Usar bots o automatizaciones</li>
              <li>Realizar ataques técnicos al servicio</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3 text-primary-foreground">3. Cuentas de Usuario</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Debes tener al menos 13 años para crear una cuenta</li>
              <li>Eres responsable de la seguridad de tu cuenta</li>
              <li>No puedes transferir tu cuenta a otros</li>
              <li>Podemos suspender cuentas que violen estos términos</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3 text-primary-foreground">4. Propiedad Intelectual</h2>
            <p className="text-muted-foreground">
              "El Pueblo Duerme" y todo su contenido son propiedad nuestra.
              Otorgamos una licencia limitada para uso personal no comercial.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3 text-primary-foreground">5. Limitación de Responsabilidad</h2>
            <p className="text-muted-foreground">
              El servicio se proporciona "tal cual". No garantizamos:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-muted-foreground">
              <li>Disponibilidad ininterrumpida</li>
              <li>Ausencia de errores o bugs</li>
              <li>Seguridad absoluta de los datos</li>
              <li>Compatibilidad con todos los dispositivos</li>
            </ul>
            <p className="mt-3 text-muted-foreground">
              En ningún caso seremos responsables por daños indirectos o consecuentes.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3 text-primary-foreground">6. Modificaciones del Servicio</h2>
            <p className="text-muted-foreground">
              Podemos modificar o discontinuar el servicio en cualquier momento.
              Intentaremos notificar cambios significativos con antelación.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3 text-primary-foreground">7. Ley Aplicable</h2>
            <p className="text-muted-foreground">
              Estos términos se rigen por las leyes de España. Cualquier disputa se resolverá en los tribunales de Madrid.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3 text-primary-foreground">8. Contacto</h2>
            <div className="p-4 bg-background/50 rounded border border-border/30">
              <p className="font-medium">Email legal: <a href="mailto:legal@elpuebloduerme.app" className="text-blue-400 hover:underline">legal@elpuebloduerme.app</a></p>
              <p className="mt-1 text-sm text-muted-foreground">Para reclamaciones o notificaciones formales</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
