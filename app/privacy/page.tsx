export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white py-12">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-4xl font-bold font-headline mb-8 text-center text-primary">Política de Privacidad</h1>
        
        <div className="bg-card/80 rounded-lg shadow-lg p-8 space-y-6 border border-border/50">
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">1. Información que Recopilamos</h2>
            <p className="text-muted-foreground">
              Para proporcionar el servicio de "El Pueblo Duerme", recopilamos:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-muted-foreground">
              <li>Dirección de correo electrónico (para autenticación, si decides registrarte).</li>
              <li>Nombre de usuario elegido.</li>
              <li>Registro de partidas jugadas y acciones realizadas (votos, roles, etc.) para estadísticas.</li>
              <li>Dirección IP (para prevención de fraude y abuso).</li>
              <li>Cookies técnicas necesarias para el funcionamiento y la seguridad de la sesión.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">2. Uso de la Información</h2>
            <p className="text-muted-foreground">
              Utilizamos tu información exclusivamente para:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-muted-foreground">
              <li>Gestionar tu cuenta y acceso al juego.</li>
              <li>Facilitar el juego multijugador en tiempo real.</li>
              <li>Prevenir fraudes, trampas y abusos del sistema.</li>
              <li>Mejorar la experiencia de juego y balancear roles.</li>
              <li>Cumplir con nuestras obligaciones legales.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">3. Compartición de Datos</h2>
            <p className="text-muted-foreground">
              <strong>No vendemos, alquilamos ni cedemos tus datos personales.</strong> Solo compartimos información con:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-muted-foreground">
              <li>Proveedores de servicios esenciales que procesan datos en nuestro nombre (Firebase para backend, Vercel para hosting), bajo estrictos acuerdos de confidencialidad.</li>
              <li>Autoridades judiciales si es requerido por una orden legal válida.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">4. Tus Derechos</h2>
            <p className="text-muted-foreground">De acuerdo con el GDPR, tienes derecho a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1 text-muted-foreground">
              <li>Acceder a tus datos personales.</li>
              <li>Rectificar información que sea inexacta.</li>
              <li>Solicitar la eliminación completa de tus datos ("derecho al olvido").</li>
              <li>Oponerte al tratamiento de tus datos para fines específicos.</li>
              <li>Solicitar la portabilidad de tus datos.</li>
            </ul>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">5. Contacto y Ejercicio de Derechos</h2>
            <p className="text-muted-foreground">
              Para ejercer tus derechos o para cualquier consulta sobre privacidad:
            </p>
            <div className="mt-3 p-4 bg-background/50 rounded border border-border">
              <p className="font-medium">Email: <a href="mailto:privacy@elpuebloduerme.com" className="text-blue-400 hover:underline">privacy@elpuebloduerme.com</a></p>
              <p className="mt-1 text-sm text-muted-foreground">Plazo de respuesta: Nos comprometemos a responder en un máximo de 30 días.</p>
            </div>
          </section>
          
          <section>
            <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">6. Cambios en esta Política</h2>
            <p className="text-muted-foreground">
              Podemos actualizar esta política para reflejar cambios en nuestras prácticas. Te notificaremos los cambios significativos a través de la aplicación o por email.
              <br/>
              Fecha de última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
