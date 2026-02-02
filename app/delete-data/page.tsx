export default function DeleteDataPage() {
  return (
    <div className="container mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-bold mb-6">Eliminar mis datos</h1>
      <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4 mb-6">
        <p className="text-yellow-200">
          ⚠️ <strong>Atención:</strong> Eliminar tus datos es irreversible. Perderás todas tus estadísticas y logros.
        </p>
      </div>
      
      <div className="space-y-4 text-gray-300">
        <p>Para solicitar la eliminación de todos tus datos asociados con el juego:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li>Envía un email desde la dirección de correo con la que te registraste (si aplica) a <strong>privacy@elpuebloduerme.com</strong>.</li>
          <li>Incluye tu nombre de usuario exacto en la aplicación.</li>
          <li>Indica &quot;Solicitud de eliminación de datos de usuario&quot; en el asunto del correo.</li>
          <li>Procesaremos tu solicitud en un plazo de 7 a 14 días hábiles y te notificaremos una vez que se haya completado.</li>
        </ol>
        
        <p className="mt-4">
          Alternativamente, si tu cuenta fue creada a través de un proveedor de autenticación (como Google), puedes eliminar tu cuenta directamente desde la configuración de tu perfil en la aplicación:
        </p>
        <div className="bg-gray-800 p-4 rounded mt-2">
          <code className="text-sm text-gray-400">
            Mi Perfil → Configuración de Cuenta → Eliminar mi cuenta permanentemente
          </code>
        </div>
      </div>
    </div>
  );
}
