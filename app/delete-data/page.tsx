'use client';

import { useState } from 'react';

export default function DeleteDataPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const handleDeleteRequest = async () => {
    if (!email || !email.includes('@')) {
      setMessage('Por favor, introduce un email válido');
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      // En un caso real, aquí llamarías a tu backend (e.g., una Cloud Function)
      // para registrar la solicitud de eliminación.
      // await requestDataDeletion({ email });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setMessage('✅ Solicitud recibida. Te contactaremos en 7 días hábiles para confirmar la eliminación.');
      setStep(2);
    } catch (error) {
      setMessage('❌ Error al procesar la solicitud. Por favor, inténtalo de nuevo o contacta con el soporte.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-4xl font-bold font-headline mb-8 text-center text-primary">Eliminar Mis Datos</h1>
        
        <div className="bg-card/80 rounded-lg shadow-lg p-8 space-y-6 border border-border/50">
          {step === 1 && (
            <>
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0 text-red-500 text-2xl">
                    ⚠️
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-semibold text-red-400">Advertencia Importante</h3>
                    <p className="mt-1 text-red-300">
                      La eliminación de datos es <strong>permanente e irreversible</strong>. Perderás:
                    </p>
                    <ul className="list-disc pl-5 mt-2 text-red-300 space-y-1">
                      <li>Todas tus partidas y estadísticas.</li>
                      <li>Tu historial de juego completo.</li>
                      <li>Tu cuenta y nombre de usuario.</li>
                      <li>Cualquier progreso o logro desbloqueado.</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-6">
                <h2 className="text-2xl font-semibold font-headline mb-3 text-primary-foreground">Solicitud de Eliminación por Email</h2>
                <p className="text-muted-foreground mb-4">
                  Para cumplir con el GDPR, procesamos todas las solicitudes de eliminación manualmente para garantizar la seguridad.
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email-delete" className="block text-sm font-medium text-muted-foreground mb-2">
                      Email asociado a tu cuenta
                    </label>
                    <input
                      id="email-delete"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-input bg-background rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      placeholder="tu@email.com"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="message-delete" className="block text-sm font-medium text-muted-foreground mb-2">
                      Mensaje (opcional)
                    </label>
                    <textarea
                      id="message-delete"
                      className="w-full px-4 py-2 border border-input bg-background rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                      rows={3}
                      placeholder="Información adicional o razones de la solicitud..."
                    />
                  </div>
                  
                  {message && <p className={`text-sm ${message.startsWith('❌') ? 'text-red-400' : 'text-green-400'}`}>{message}</p>}

                  <button
                    onClick={handleDeleteRequest}
                    disabled={loading}
                    className="w-full bg-destructive text-destructive-foreground py-3 px-4 rounded-lg font-semibold hover:bg-destructive/90 transition disabled:opacity-50"
                  >
                    {loading ? 'PROCESANDO...' : 'ENVIAR SOLICITUD DE ELIMINACIÓN'}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="text-center py-8">
              <div className="text-green-500 text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold font-headline mb-4 text-primary-foreground">Solicitud Recibida</h2>
              <p className="text-muted-foreground mb-6">
                Hemos recibido tu solicitud de eliminación de datos.
                Te contactaremos a la dirección de email proporcionada en un plazo de 7 días hábiles para confirmar la ejecución.
              </p>
              <p className="text-sm text-gray-500">
                Número de referencia de la solicitud: {Date.now().toString(36).toUpperCase()}
              </p>
            </div>
          )}

          <div className="border-t border-border/50 pt-6">
            <h3 className="font-semibold mb-2 text-primary-foreground">Contacto Directo de Privacidad</h3>
            <p className="text-muted-foreground">
              Para urgencias o preguntas: 
              <a href="mailto:privacy@elpuebloduerme.app" className="ml-2 text-blue-400 font-medium hover:underline">privacy@elpuebloduerme.app</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
