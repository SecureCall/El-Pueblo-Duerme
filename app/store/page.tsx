'use client';

import Link from 'next/link';
import { Coins, ShoppingBag, Palette, Gamepad2, Users, Gift, UserCircle } from 'lucide-react';
import { VideoReward } from './components/VideoReward';
import { StoreItem, StoreItemData } from './components/StoreItem';
import { AdBanner } from '@/components/ads/AdBanner';
import { NativeBanner } from '@/components/ads/NativeBanner';
import { useCoins } from '@/app/hooks/use-coins';
import { useAuth } from '@/app/providers/AuthProvider';

const AVATAR_ITEMS: StoreItemData[] = [
  { id: 'avatar-aldeano-sabio', name: 'Aldeano Sabio', description: 'Un anciano con barba y un libro de conocimiento.', price: 300, icon: '📚', image: '/avatares/Aldeano sabio con barba y un libro.png', category: 'avatares' },
  { id: 'avatar-bruja', name: 'Bruja Misteriosa', description: 'Una bruja con sombrero puntiagudo y caldero.', price: 400, icon: '🧙‍♀️', image: '/avatares/Bruja misteriosa con un sombrero puntiagudo y un caldero.png', category: 'avatares', badge: 'Popular' },
  { id: 'avatar-guardia', name: 'Guardia Valiente', description: 'Un valiente guardia con armadura y espada.', price: 350, icon: '⚔️', image: '/avatares/Guardia valiente con armadura y una espada.png', category: 'avatares' },
  { id: 'avatar-panadero', name: 'Panadero', description: 'Un panadero sonriente con delantal y pan recién horneado.', price: 200, icon: '🍞', image: '/avatares/Panadero sonriente con un delantal y pan recién horneado.png', category: 'avatares' },
  { id: 'avatar-doncella', name: 'Joven Doncella', description: 'Una joven con flores en el cabello.', price: 250, icon: '🌸', image: '/avatares/Una joven doncella con flores en el cabello.png', category: 'avatares' },
  { id: 'avatar-monja', name: 'Monja Devota', description: 'Una monja con hábito y rosario.', price: 250, icon: '✝️', image: '/avatares/Una monja con un hábito y un rosario.png', category: 'avatares' },
  { id: 'avatar-herrero', name: 'Anciano Herrero', description: 'Un anciano herrero con martillo y yunque.', price: 300, icon: '🔨', image: '/avatares/Un anciano herrero con martillo y yunque.png', category: 'avatares' },
  { id: 'avatar-nina', name: 'Niña Inocente', description: 'Una niña pequeña con su osito de peluche.', price: 350, icon: '🧸', image: '/avatares/Una niña pequeña con un osito de peluche.png', category: 'avatares', badge: 'Raro' },
  { id: 'avatar-tejedora', name: 'Tejedora', description: 'Una tejedora hábil con hilo y telar.', price: 200, icon: '🧵', image: '/avatares/Una tejedora con hilo y un telar.png', category: 'avatares' },
  { id: 'avatar-boticario', name: 'Boticario', description: 'Un boticario con frascos y pociones misteriosas.', price: 300, icon: '⚗️', image: '/avatares/Un boticario con frascos y pociones.png', category: 'avatares' },
  { id: 'avatar-cazador', name: 'Cazador', description: 'Un cazador con arco y flechas.', price: 350, icon: '🏹', image: '/avatares/Un cazador con un arco y flechas.png', category: 'avatares' },
  { id: 'avatar-clerigo', name: 'Clérigo Sagrado', description: 'Un clérigo portando su símbolo sagrado.', price: 300, icon: '⛪', image: '/avatares/Un clérigo con un símbolo sagrado.png', category: 'avatares' },
  { id: 'avatar-granjero', name: 'Granjero Robusto', description: 'Un granjero robusto con rastrillo y sombrero de paja.', price: 200, icon: '🌾', image: '/avatares/Un granjero robusto con un rastrillo y un sombrero de paja.png', category: 'avatares' },
  { id: 'avatar-lobo-oveja', name: 'Lobo en Piel de Oveja', description: 'Un lobo disfrazado de oveja con sonrisa astuta.', price: 600, icon: '🐺', image: '/avatares/Un lobo disfrazado de oveja, con una sonrisa astuta.png', category: 'avatares', badge: 'Épico' },
  { id: 'avatar-medico-plaga', name: 'Médico de la Plaga', description: 'Un médico con la inconfundible máscara de la plaga.', price: 500, icon: '🎭', image: '/avatares/Un médico de la plaga con una máscara distintiva.png', category: 'avatares', badge: 'Raro' },
  { id: 'avatar-noble', name: 'Noble Elegante', description: 'Un noble con ropas elegantes y una pluma de escribir.', price: 400, icon: '🎩', image: '/avatares/Un noble con ropas elegantes y una pluma.png', category: 'avatares' },
  { id: 'avatar-pescador', name: 'Pescador', description: 'Un pescador tranquilo con caña y pez.', price: 200, icon: '🎣', image: '/avatares/Un pescador con una caña y un pez.png', category: 'avatares' },
  { id: 'avatar-picaro', name: 'Pícaro con Daga', description: 'Un pícaro con capucha y una daga oculta.', price: 450, icon: '🗡️', image: '/avatares/Un pícaro con capucha y una daga.png', category: 'avatares' },
  { id: 'avatar-trovador', name: 'Trovador', description: 'Un trovador con laúd y capa colorida.', price: 300, icon: '🎵', image: '/avatares/Un trovador con un laúd y una capa.png', category: 'avatares' },
];

const STORE_ITEMS: StoreItemData[] = [
  { id: 'marco-dorado', name: 'Marco Dorado', description: 'Marco brillante para tu avatar.', price: 300, icon: '✨', category: 'cosmeticos' },
  { id: 'marco-sangre', name: 'Marco de Sangre', description: 'Marco rojo oscuro para los más temidos.', price: 350, icon: '🩸', category: 'cosmeticos' },
  { id: 'tema-luna', name: 'Tema Luna Llena', description: 'Paleta de colores azul noche.', price: 400, icon: '🌕', category: 'cosmeticos' },
  { id: 'emote-aullido', name: 'Emote Aullido', description: 'Reacción especial de aullido en el chat.', price: 200, icon: '😤', category: 'cosmeticos' },
  { id: 'emote-cuchillo', name: 'Emote Cuchillo', description: 'Amenaza en silencio con este emote nocturno.', price: 200, icon: '🔪', category: 'cosmeticos' },

  { id: 'sala-premium', name: 'Sala Premium', description: 'Crea partidas con hasta 32 jugadores y configuraciones especiales.', price: 800, icon: '👑', category: 'juego', badge: 'Exclusivo' },
  { id: 'destacar-sala', name: 'Destacar Sala', description: 'Tu partida aparece primera en la lista pública durante 24h.', price: 300, icon: '📌', category: 'juego' },
  { id: 'estadisticas', name: 'Historial Extendido', description: 'Gráficas y estadísticas detalladas de todas tus partidas.', price: 600, icon: '📊', category: 'juego' },

  { id: 'titulo-maestro-lobo', name: 'Título: Maestro Lobo', description: 'Muestra este título junto a tu nombre.', price: 400, icon: '🏅', category: 'social' },
  { id: 'titulo-aldea-legendario', name: 'Título: Aldeano Legendario', description: 'Para los defensores más valientes del pueblo.', price: 400, icon: '🛡️', category: 'social' },
  { id: 'mensaje-dorado', name: 'Mensajes Dorados', description: 'Tus mensajes en el chat tienen borde dorado permanente.', price: 700, icon: '💬', category: 'social', badge: 'Premium' },

  { id: 'cofre-misterioso', name: 'Cofre Misterioso', description: 'Obtén un cosmético aleatorio. ¡Suerte!', price: 250, icon: '📦', category: 'recompensas' },
  { id: 'cofre-epico', name: 'Cofre Épico', description: 'Mayor probabilidad de obtener artículos raros.', price: 600, icon: '🎁', category: 'recompensas', badge: 'Nuevo' },
  { id: 'pase-temporada', name: 'Pase de Temporada', description: 'Acceso a contenido exclusivo de este mes.', price: 1500, icon: '🎫', category: 'recompensas', badge: 'Mes' },
];

const ALL_ITEMS = [...AVATAR_ITEMS, ...STORE_ITEMS];

const CATEGORIES = [
  { id: 'avatares', label: 'Avatares', icon: UserCircle, cols: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7' },
  { id: 'cosmeticos', label: 'Cosméticos', icon: Palette, cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' },
  { id: 'juego', label: 'Ventajas de Juego', icon: Gamepad2, cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' },
  { id: 'social', label: 'Social', icon: Users, cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' },
  { id: 'recompensas', label: 'Recompensas', icon: Gift, cols: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' },
];

export default function StorePage() {
  const { user } = useAuth();
  const { coins, refresh } = useCoins();

  return (
    <div className="relative min-h-screen w-full text-white" style={{ backgroundImage: 'url(/noche.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(5, 10, 20, 0.88)' }} />

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
        <div className="mb-8">
          <VideoReward onCoinsEarned={refresh} />
        </div>

        {/* Banners Adsterra */}
        <div className="mb-10 space-y-4">
          <div className="flex justify-center">
            <AdBanner format="horizontal" />
          </div>
          <NativeBanner />
        </div>

        {/* Store Categories */}
        {CATEGORIES.map((cat, idx) => {
          const items = ALL_ITEMS.filter(i => i.category === cat.id);
          const Icon = cat.icon;
          return (
            <div key={cat.id}>
              <div className="mb-14">
                <div className="flex items-center gap-3 mb-5">
                  <div className="bg-white/10 rounded-lg p-2">
                    <Icon className="h-5 w-5 text-yellow-400" />
                  </div>
                  <h2 className="text-2xl font-bold font-headline">{cat.label}</h2>
                  <span className="text-white/30 text-sm">{items.length} artículos</span>
                </div>
                <div className={`grid ${cat.cols} gap-3`}>
                  {items.map(item => (
                    <StoreItem key={item.id} item={item} userCoins={coins} onPurchase={refresh} />
                  ))}
                </div>
              </div>
              {/* Banner 300x250 después de avatares y cosméticos */}
              {(idx === 0 || idx === 2) && (
                <div className="mb-10 flex justify-center">
                  <AdBanner format="rectangle" />
                </div>
              )}
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
