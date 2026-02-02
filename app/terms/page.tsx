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
          <p>Se espera que todos los jugadores mantengan un ambiente de respeto. Está estrictamente prohibido:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>Hacer trampas, usar exploits o manipular la lógica del juego.</li>
            <li>Acosar, insultar o usar lenguaje ofensivo contra otros jugadores.</li>
            <li>Crear múltiples cuentas para obtener una ventaja injusta.</li>
            <li>Compartir información externa al juego que pueda afectar el resultado.</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">3. Limitación de responsabilidad</h2>
          <p>El juego se provee &quot;tal cual&quot;. No nos hacemos responsables por:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>Pérdida de datos o progreso en el juego.</li>
            <li>Interrupciones del servicio o bugs.</li>
            <li>Decisiones de moderación, incluyendo la suspensión de cuentas.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Modificación de los Términos</h2>
          <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Se notificará de los cambios importantes a través de la aplicación.</p>
        </section>
      </div>
    </div>
  );
}
