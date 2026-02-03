export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-bold mb-8 text-center">Política de Privacidad</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Información que Recopilamos</h2>
            <p className="text-gray-700">
              Para proporcionar el servicio de "El Pueblo Duerme", recopilamos:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Dirección de correo electrónico (para autenticación)</li>
              <li>Nombre de usuario elegido</li>
              <li>Registro de partidas jugadas y acciones realizadas</li>
              <li>Dirección IP (para prevención de fraude)</li>
              <li>Cookies técnicas necesarias para el funcionamiento</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Uso de la Información</h2>
            <p className="text-gray-700">
              Utilizamos tu información exclusivamente para:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Gestionar tu cuenta y acceso al juego</li>
              <li>Facilitar el juego multijugador en tiempo real</li>
              <li>Prevenir fraudes, trampas y abusos</li>
              <li>Mejorar la experiencia de juego</li>
              <li>Cumplir con obligaciones legales</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Compartición de Datos</h2>
            <p className="text-gray-700">
              <strong>No vendemos ni alquilamos tus datos.</strong> Solo compartimos información con:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Proveedores de servicios esenciales (Firebase, Vercel)</li>
              <li>Autoridades judiciales si es requerido por ley</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">4. Tus Derechos</h2>
            <p className="text-gray-700">Tienes derecho a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Acceder a tus datos personales</li>
              <li>Rectificar información inexacta</li>
              <li>Solicitar la eliminación de tus datos</li>
              <li>Oponerte al tratamiento de tus datos</li>
              <li>Portabilidad de datos</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">5. Contacto y Ejercicio de Derechos</h2>
            <p className="text-gray-700">
              Para ejercer tus derechos o consultas de privacidad:
            </p>
            <div className="mt-3 p-4 bg-gray-100 rounded">
              <p className="font-medium">Email: <span className="text-blue-600">privacy@elpuebloduerme.app</span></p>
              <p className="mt-1">Plazo de respuesta: 30 días hábiles máximo</p>
              <p className="mt-1">Dirección: [Tu dirección legal aquí]</p>
            </div>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold mb-3">6. Cambios en esta Política</h2>
            <p className="text-gray-700">
              Podemos actualizar esta política. Te notificaremos cambios significativos.
              Fecha última actualización: {new Date().toLocaleDateString('es-ES')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
