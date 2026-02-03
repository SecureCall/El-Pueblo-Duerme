export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white py-12">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-bold font-headline mb-8 text-center text-primary">Términos de Servicio</h1>
        
        <div className="bg-card/80 rounded-lg shadow-lg p-8 space-y-6 border border-border/50">
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">1. Aceptación de los Términos</h2>
            <p className="text-muted-foreground">
              Al acceder, registrarte o usar "El Pueblo Duerme" (el "Servicio"), aceptas cumplir con estos Términos de Servicio. Si no estás de acuerdo, no debes usar el Servicio.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">2. Uso Aceptable y Conducta del Usuario</h2>
            <p className="text-muted-foreground">Te comprometes a no realizar ninguna de las siguientes acciones:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-muted-foreground">
              <li>Utilizar trampas, exploits, bots, hacks o cualquier software de terceros no autorizado para modificar o automatizar el Servicio.</li>
              <li>Crear múltiples cuentas para obtener una ventaja injusta, evadir suspensiones o manipular el juego.</li>
              <li>Acosar, amenazar, discriminar o suplantar a otros jugadores.</li>
              <li>Compartir contenido que sea ilegal, ofensivo, difamatorio o que infrinja los derechos de terceros.</li>
              <li>Intentar realizar ingeniería inversa, descompilar o acceder al código fuente del Servicio.</li>
              <li>Realizar ataques técnicos, como ataques de denegación de servicio (DDoS), para interrumpir el Servicio.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">3. Cuentas de Usuario</h2>
            <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
              <li>Debes tener al menos 13 años (o la edad mínima requerida en tu país) para crear una cuenta.</li>
              <li>Eres el único responsable de la seguridad de tu cuenta y contraseña.</li>
              <li>Nos reservamos el derecho de suspender o eliminar tu cuenta si violas estos términos, sin previo aviso.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">4. Propiedad Intelectual</h2>
            <p className="text-muted-foreground">
              "El Pueblo Duerme" y todo su contenido (código, gráficos, música, etc.) son propiedad de sus respectivos creadores. Te otorgamos una licencia limitada, no exclusiva y no transferible para usar el Servicio para fines personales y no comerciales.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">5. Limitación de Responsabilidad</h2>
            <p className="text-muted-foreground">
              El Servicio se proporciona "tal cual". No garantizamos disponibilidad ininterrumpida, ausencia de errores o seguridad absoluta. En la máxima medida permitida por la ley, no seremos responsables por daños indirectos, incidentales o consecuentes derivados del uso del Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">6. Ley Aplicable y Jurisdicción</h2>
            <p className="text-muted-foreground">
              Estos términos se rigen por las leyes de España. Cualquier disputa se resolverá en los tribunales competentes de la ciudad de Madrid, renunciando a cualquier otro fuero.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">7. Contacto</h2>
            <div className="p-4 bg-background/50 rounded border border-border">
              <p className="font-medium">Email para asuntos legales: <a href="mailto:legal@elpuebloduerme.com" className="text-blue-400 hover:underline">legal@elpuebloduerme.app</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
