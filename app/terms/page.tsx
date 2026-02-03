export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">Términos de Servicio</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Aceptación de los Términos</h2>
            <p className="text-gray-700">
              Al acceder y usar "El Pueblo Duerme", aceptas estos términos. Si no estás de acuerdo, no uses el servicio.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Uso Aceptable</h2>
            <p className="text-gray-700">Está prohibido:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
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
            <h2 className="text-2xl font-semibold mb-3">3. Cuentas de Usuario</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Debes tener al menos 13 años para crear una cuenta</li>
              <li>Eres responsable de la seguridad de tu cuenta</li>
              <li>No puedes transferir tu cuenta a otros</li>
              <li>Podemos suspender cuentas que violen estos términos</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Propiedad Intelectual</h2>
            <p className="text-gray-700">
              "El Pueblo Duerme" y todo su contenido son propiedad de [Tu Empresa].
              Otorgamos una licencia limitada para uso personal no comercial.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Limitación de Responsabilidad</h2>
            <p className="text-gray-700">
              El servicio se proporciona "tal cual". No garantizamos:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Disponibilidad ininterrumpida</li>
              <li>Ausencia de errores o bugs</li>
              <li>Seguridad absoluta de los datos</li>
              <li>Compatibilidad con todos los dispositivos</li>
            </ul>
            <p className="mt-3 text-gray-700">
              En ningún caso seremos responsables por daños indirectos o consecuentes.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Modificaciones del Servicio</h2>
            <p className="text-gray-700">
              Podemos modificar o discontinuar el servicio en cualquier momento.
              Intentaremos notificar cambios significativos con antelación.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">7. Ley Aplicable</h2>
            <p className="text-gray-700">
              Estos términos se rigen por las leyes de España. Cualquier disputa se resolverá en los tribunales de Madrid.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">8. Contacto</h2>
            <div className="p-4 bg-gray-100 rounded">
              <p className="font-medium">Email legal: <span className="text-blue-600">legal@elpuebloduerme.app</span></p>
              <p className="mt-1">Para reclamaciones o notificaciones formales</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
