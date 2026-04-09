import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad — El Pueblo Duerme',
  description: 'Política de privacidad del juego El Pueblo Duerme.',
};

const LAST_UPDATED = '9 de abril de 2026';
const CONTACT_EMAIL = 'privacidad@elpuebloduerme.com';
const APP_NAME = 'El Pueblo Duerme';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-amber-400 hover:text-amber-300 transition-colors mb-8 text-sm"
        >
          ← Volver al inicio
        </Link>

        <h1 className="text-3xl font-bold text-amber-400 mb-2 font-serif">
          Política de Privacidad
        </h1>
        <p className="text-stone-400 text-sm mb-10">
          Última actualización: {LAST_UPDATED}
        </p>

        <Section title="1. Quiénes somos">
          <p>
            {APP_NAME} es un juego multijugador de deducción social accesible en la web y
            como aplicación instalable (PWA / TWA). El responsable del tratamiento de datos
            es el desarrollador de {APP_NAME}. Puedes contactarnos en{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-400 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="2. Datos que recopilamos">
          <p className="mb-3">Recopilamos únicamente los datos necesarios para el funcionamiento del juego:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Cuenta de Google</strong> — nombre de pantalla y foto de perfil obtenidos
              mediante Google Sign-In. No accedemos a tu correo electrónico ni a otros datos
              de tu cuenta de Google.
            </li>
            <li>
              <strong>Datos de partida</strong> — acciones dentro del juego (votos, roles,
              mensajes de chat) almacenados en Firebase Firestore. Estos datos son necesarios
              para el funcionamiento del juego en tiempo real.
            </li>
            <li>
              <strong>Estadísticas de juego</strong> — puntos de experiencia (XP), nivel,
              victorias y partidas jugadas.
            </li>
            <li>
              <strong>Suscripciones push</strong> (opcional) — si activas las notificaciones,
              guardamos la suscripción de tu dispositivo para enviarte avisos de partida.
              Puedes desactivarlas en cualquier momento desde los ajustes de tu navegador o
              sistema operativo.
            </li>
            <li>
              <strong>Datos de diagnóstico</strong> — registros técnicos anónimos (errores,
              tiempos de carga) para mejorar el servicio.
            </li>
          </ul>
        </Section>

        <Section title="3. Finalidad y base legal">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-stone-700">
                <th className="text-left py-2 pr-4 text-stone-300 font-semibold">Finalidad</th>
                <th className="text-left py-2 text-stone-300 font-semibold">Base legal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {[
                ['Autenticación y acceso al juego', 'Ejecución del contrato (términos de servicio)'],
                ['Partidas multijugador en tiempo real', 'Ejecución del contrato'],
                ['Estadísticas y progresión (XP/nivel)', 'Ejecución del contrato'],
                ['Notificaciones push', 'Consentimiento explícito del usuario'],
                ['Mejora del servicio y diagnóstico', 'Interés legítimo'],
                ['Publicidad (Google AdSense)', 'Consentimiento / Interés legítimo'],
              ].map(([purpose, basis]) => (
                <tr key={purpose}>
                  <td className="py-2 pr-4 text-stone-300">{purpose}</td>
                  <td className="py-2 text-stone-400">{basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="4. Proveedores de servicios">
          <p className="mb-3">Utilizamos los siguientes servicios de terceros:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Google Firebase</strong> (Firestore, Authentication, Storage) — almacenamiento
              de datos de juego y autenticación.{' '}
              <a href="https://firebase.google.com/support/privacy" className="text-amber-400 underline" target="_blank" rel="noopener noreferrer">
                Política de privacidad de Firebase
              </a>
              .
            </li>
            <li>
              <strong>Google AdSense</strong> — publicidad contextual. Puede usar cookies para
              personalizar anuncios.{' '}
              <a href="https://policies.google.com/technologies/ads" className="text-amber-400 underline" target="_blank" rel="noopener noreferrer">
                Política publicitaria de Google
              </a>
              .
            </li>
            <li>
              <strong>Google Gemini API</strong> — inteligencia artificial para modo de relleno
              automático de partidas. No se envían datos personales identificables.
            </li>
            <li>
              <strong>Vercel</strong> — infraestructura de alojamiento web.
            </li>
          </ul>
        </Section>

        <Section title="5. Conservación de datos">
          <p>
            Los datos de partida se conservan durante el tiempo en que tu cuenta esté activa.
            Puedes solicitar la eliminación de tu cuenta y todos tus datos en cualquier momento
            escribiéndonos a{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-400 underline">
              {CONTACT_EMAIL}
            </a>
            . Eliminaremos tus datos en un plazo máximo de 30 días.
          </p>
        </Section>

        <Section title="6. Tus derechos">
          <p className="mb-3">
            De acuerdo con el RGPD (si resides en la UE) y legislaciones equivalentes,
            tienes los siguientes derechos:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Acceso a los datos que conservamos sobre ti.</li>
            <li>Rectificación de datos incorrectos.</li>
            <li>Supresión («derecho al olvido»).</li>
            <li>Portabilidad de tus datos en formato legible por máquina.</li>
            <li>Oposición al tratamiento basado en interés legítimo.</li>
            <li>Retirada del consentimiento en cualquier momento (sin efecto retroactivo).</li>
          </ul>
          <p className="mt-3">
            Para ejercer cualquiera de estos derechos, escríbenos a{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-400 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="7. Menores de edad">
          <p>
            {APP_NAME} no está dirigido a menores de 13 años. No recopilamos intencionadamente
            datos de menores. Si eres padre o tutor y crees que tu hijo nos ha proporcionado
            datos personales, contáctanos y los eliminaremos de inmediato.
          </p>
        </Section>

        <Section title="8. Seguridad">
          <p>
            Aplicamos medidas técnicas y organizativas para proteger tus datos: comunicaciones
            cifradas (HTTPS/TLS), reglas de seguridad de Firestore que restringen el acceso a
            los datos de cada partida, y autenticación mediante Firebase Authentication.
          </p>
        </Section>

        <Section title="9. Cambios en esta política">
          <p>
            Podemos actualizar esta política ocasionalmente. Cuando lo hagamos, actualizaremos
            la fecha de «Última actualización» que aparece al inicio de esta página. Si los
            cambios son sustanciales, te informaremos mediante una notificación en el juego.
          </p>
        </Section>

        <Section title="10. Contacto">
          <p>
            Si tienes preguntas sobre esta política o sobre cómo tratamos tus datos, escríbenos a{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-amber-400 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <div className="mt-12 pt-6 border-t border-stone-800 flex flex-wrap gap-6 text-sm text-stone-500">
          <Link href="/" className="hover:text-amber-400 transition-colors">Inicio</Link>
          <Link href="/how-to-play" className="hover:text-amber-400 transition-colors">Cómo Jugar</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold text-amber-300 mb-3 font-serif">{title}</h2>
      <div className="text-stone-300 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
