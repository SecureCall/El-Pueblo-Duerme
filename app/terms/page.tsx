export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-bold mb-6">Términos de Servicio</h1>
      <div className="space-y-4 text-gray-300">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Aceptación de términos</h2>
          <p>Al usar El Pueblo Duerme, aceptas estos términos. Si no estás de acuerdo, no uses el servicio.</p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">2. Conducta del usuario</h2>
          <p>Prohibido:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>Hacer trampas o usar exploits</li>
            <li>Acosar a otros jugadores</li>
            <li>Crear múltiples cuentas para ventaja injusta</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">3. Limitación de responsabilidad</h2>
          <p>El juego se provee &quot;tal cual&quot;. No nos hacemos responsables por:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>Pérdida de datos</li>
            <li>Interrupciones del servicio</li>
            <li>Decisiones de moderación</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
