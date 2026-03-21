'use client';

import Link from 'next/link';
import { Coins, ShoppingBag, Palette, Gamepad2, Users, Gift } from 'lucide-react';
import { VideoReward } from './components/VideoReward';
import { StoreItem, StoreItemData } from './components/StoreItem';
import { useCoins } from '@/app/hooks/use-coins';
import { useAuth } from '@/app/providers/AuthProvider';

const STORE_ITEMS: StoreItemData[] = [
  // Cosméticos
  { id: 'avatar-lobo', name: 'Avatar Lobo Místico', description: 'Un avatar exclusivo con aura de lobo.', price: 500, icon: '🐺', category: 'cosmeticos', badge: 'Popular' },
  { id: 'avatar-vidente', name: 'Avatar Vidente Oscura', description: 'Un avatar misterioso de vidente.', price: 500, icon: '🔮', category: 'cosmeticos' },
  { id: 'marco-dorado', name: 'Marco Dorado', description: 'Marco brillante para tu avatar.', price: 300, icon: '✨', category: 'cosmeticos' },
  { id: 'marco-sangre', name: 'Marco de Sangre', description: 'Marco rojo oscuro para los más temidos.', price: 350, icon: '🩸', category: 'cosmeticos' },
  { id: 'tema-luna', name: 'Tema Luna Llena', description: 'Paleta de colores azul noche.', price: 400, icon: '🌕', category: 'cosmeticos' },
  { id: 'emote-aullido', name: 'Emote Aullido', description: 'Reacción especial de aullido en el chat.', price: 200, icon: '😤', category: 'cosmeticos' },

  // Ventajas de juego
  { id: 'sala-premium', name: 'Sala Premium', description: 'Crea partidas con hasta 32 jugadores y configuraciones especiales.', price: 800, icon: '👑', category: 'juego', badge: 'Exclusivo' },
  { id: 'destacar-sala', name: 'Destacar Sala', description: 'Tu partida aparece primera en la lista pública durante 24h.', price: 300, icon: '📌', category: 'juego' },
  { id: 'rol-hechicero', name: 'Rol Hechicero', description: 'Desbloquea el rol secreto Hechicero con poderes únicos.', price: 1000, icon: '🧙', category: 'juego', badge: 'Raro' },
  { id: 'rol-espiritu', name: 'Rol Espíritu', description: 'Vuelve al juego como espíritu tras ser eliminado.', price: 1200, icon: '👻', category: 'juego', badge: 'Épico' },
  { id: 'estadisticas', name: 'Historial Extendido', description: 'Gráficas y estadísticas detalladas de todas tus partidas.', price: 600, icon: '📊', category: 'juego' },

  // Social
  { id: 'titulo-maestro-lobo', name: 'Título: Maestro Lobo', description: 'Muestra este título junto a tu nombre.', price: 400, icon: '🏅', category: 'social' },
  { id: 'titulo-aldea-legendario', name: 'Título: Aldeano Legendario', description: 'Para los defensores más valientes del pueblo.', price: 400, icon: '🛡️', category: 'social' },
  { id: 'mensaje-dorado', name: 'Mensajes Dorados', description: 'Tus mensajes en el chat tienen borde dorado permanente.', price: 700, icon: '💬', category: 'social', badge: 'Premium' },
  { id: 'perfil-fondo', name: 'Fondo de Perfil', description: 'Personaliza tu perfil con un fondo animado.', price: 500, icon: '🖼️', category: 'social' },

  // Recompensas
  { id: 'pase-temporada', name: 'Pase de Temporada', description: 'Acceso a contenido exclusivo de este mes.', price: 1500, icon: '🎫', category: 'recompensas', badge: 'Mes' },
  { id: 'cofre-misterioso', name: 'Cofre Misterioso', description: 'Obtén un cosmético aleatorio. ¡Suerte!', price: 250, icon: '📦', category: 'recompensas' },
  { id: 'cofre-epico', name: 'Cofre Épico', description: 'Mayor probabilidad de obtener artículos raros.', price: 600, icon: '🎁', category: 'recompensas', badge: 'Nuevo' },
];

const CATEGORIES = [
  { id: 'cosmeticos', label: 'Cosméticos', icon: Palette },
  { id: 'juego', label: 'Ventajas de Juego', icon: Gamepad2 },
  { id: 'social', label: 'Social', icon: Users },
  { id: 'recompensas', label: 'Recompensas', icon: Gift },
];

export default function StorePage() {
  const { user } = useAuth();
  const { coins, refresh } = useCoins();

  return (
    <div className="relative min-h-screen w-full text-white" style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(5, 10, 20, 0.85)' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-white/70 hover:text-white transition-colors text-sm">
            ← Volver al Inicio
          </Link>
          <div className="flex items-center gap-2 bg-yellow-500/20 border border-yellow-500/40 rounded-full px-4 py-2">
            <Coins className="h-5 w-5 text-yellow-400" />
            <span className="font-bold text-yellow-300 text-lg">
              {user ? (coins === null ? '...' : coins.toLocaleString()) : '—'}
            </span>
            <span className="text-yellow-400/70 text-sm">monedas</span>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-2">
            <ShoppingBag className="h-8 w-8 text-yellow-400" />
            <h1 className="font-headline text-5xl font-bold">Tienda</h1>
          </div>
          <p className="text-white/60">Gana monedas viendo vídeos y canjéalas por artículos exclusivos</p>
          {!user && (
            <p className="mt-2 text-yellow-400 text-sm">
              <Link href="/login" className="underline hover:text-yellow-300">Inicia sesión</Link> para comprar artículos y ganar monedas
            </p>
          )}
        </div>

        {/* Video Reward */}
        <div className="mb-12">
          <VideoReward onCoinsEarned={refresh} />
        </div>

        {/* Store Categories */}
        {CATEGORIES.map(cat => {
          const items = STORE_ITEMS.filter(i => i.category === cat.id);
          const Icon = cat.icon;
          return (
            <div key={cat.id} className="mb-12">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-white/10 rounded-lg p-2">
                  <Icon className="h-5 w-5 text-yellow-400" />
                </div>
                <h2 className="text-2xl font-bold font-headline">{cat.label}</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {items.map(item => (
                  <StoreItem key={item.id} item={item} userCoins={coins} onPurchase={refresh} />
                ))}
              </div>
            </div>
          );
        })}

        <p className="text-center text-white/30 text-xs mt-8 pb-6">
          Las monedas son virtuales y no tienen valor monetario real. Solo para uso en El Pueblo Duerme.
        </p>
      </div>
    </div>
  );
}
