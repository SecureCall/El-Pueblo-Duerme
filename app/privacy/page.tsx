export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-bold mb-6">Política de Privacidad</h1>
      <div className="space-y-4 text-gray-300">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Información que recopilamos</h2>
          <p>Recopilamos únicamente la información necesaria para el funcionamiento del juego:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>Email (para autenticación)</li>
            <li>Nombre de usuario</li>
            <li>Acciones dentro del juego</li>
            <li>Datos de partidas (roles, votos, resultados)</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">2. Uso de la información</h2>
          <p>La información se utiliza exclusivamente para:</p>
          <ul className="list-disc pl-6 mt-2">
            <li>Gestionar tu cuenta y partidas</li>
            <li>Mejorar la experiencia de juego</li>
            <li>Prevenir fraudes y abusos</li>
          </ul>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2">3. Contacto</h2>
          <p>Para eliminar tus datos o consultas de privacidad:</p>
          <p className="mt-2">
            Email: <a href="mailto:privacy@elpuebloduerme.com" className="text-blue-400 hover:underline">privacy@elpuebloduerme.com</a>
          </p>
          <p className="mt-2">
            Tiempo de respuesta: 7 días hábiles
          </p>
        </section>
      </div>
    </div>
  );
}
