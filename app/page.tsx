'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { ShoppingBag, LogOut, Zap, Users, Shield, Sword, Bell, Sun, Moon, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { JoinByCodeModal } from '@/components/JoinByCodeModal';
import { PageAudio } from '@/components/audio/PageAudio';
import { AudioControls } from '@/components/audio/AudioControls';
import { AdBanner } from '@/components/ads/AdBanner';
import { NativeBanner } from '@/components/ads/NativeBanner';
import { TutorialOverlay } from '@/components/game/TutorialOverlay';
import { subscribeAndSave } from '@/lib/firebase/push';
import { createQuickMatch } from '@/lib/game/quickMatch';

const ROLE_CARDS = [
  { icon: '🐺', name: 'Lobo', desc: 'Mata en silencio', color: 'from-red-900/60 to-black/60', border: 'border-red-800/40' },
  { icon: '🔮', name: 'Vidente', desc: 'Conoce la verdad', color: 'from-purple-900/60 to-black/60', border: 'border-purple-800/40' },
  { icon: '🧙', name: 'Bruja', desc: 'Salva o envenena', color: 'from-emerald-900/60 to-black/60', border: 'border-emerald-800/40' },
  { icon: '🗡️', name: 'Cazador', desc: 'Muere disparando', color: 'from-amber-900/60 to-black/60', border: 'border-amber-800/40' },
  { icon: '🎭', name: 'Pícaro', desc: 'Gana siendo exiliado', color: 'from-pink-900/60 to-black/60', border: 'border-pink-800/40' },
  { icon: '😇', name: 'Ángel', desc: 'Gana muriendo el 1°', color: 'from-sky-900/60 to-black/60', border: 'border-sky-800/40' },
  { icon: '🪈', name: 'Flautista', desc: 'Hipnotiza a todos', color: 'from-indigo-900/60 to-black/60', border: 'border-indigo-800/40' },
  { icon: '🧛', name: 'Vampiro', desc: 'Convierte al pueblo', color: 'from-violet-900/60 to-black/60', border: 'border-violet-800/40' },
];

function RoleCarousel() {
  const [offset, setOffset] = useState(0);
  const cardW = 120;

  useEffect(() => {
    const id = setInterval(() => {
      setOffset(o => o - 1);
    }, 30);
    return () => clearInterval(id);
  }, []);

  const totalW = ROLE_CARDS.length * cardW;
  const wrappedOffset = ((offset % totalW) + totalW) % totalW;

  return (
    <div className="w-full overflow-hidden relative mt-10 mb-2">
      <div className="flex gap-3" style={{ transform: `translateX(-${wrappedOffset}px)`, whiteSpace: 'nowrap' }}>
        {[...ROLE_CARDS, ...ROLE_CARDS, ...ROLE_CARDS].map((r, i) => (
          <div
            key={i}
            className={`inline-flex flex-col items-center justify-center flex-shrink-0 w-[110px] h-[90px] rounded-xl border ${r.border} bg-gradient-to-b ${r.color} px-2 py-2 gap-1`}
          >
            <span className="text-2xl">{r.icon}</span>
            <span className="text-white text-[11px] font-bold leading-tight">{r.name}</span>
            <span className="text-white/40 text-[9px] leading-tight text-center">{r.desc}</span>
          </div>
        ))}
      </div>
      {/* Fade edges */}
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-black/80 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-black/80 to-transparent pointer-events-none" />
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [pushGranted, setPushGranted] = useState<boolean | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [lightMode, setLightMode] = useState(false);
  const [quickMatchLoading, setQuickMatchLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window) setPushGranted(Notification.permission === 'granted');
    if (localStorage.getItem('theme') === 'light') setLightMode(true);
  }, []);

  const toggleTheme = () => {
    const next = !lightMode;
    setLightMode(next);
    localStorage.setItem('theme', next ? 'light' : 'dark');
  };

  const handleEnablePush = async () => {
    if (!user) return;
    setPushLoading(true);
    const ok = await subscribeAndSave(user.uid);
    setPushGranted(ok);
    setPushLoading(false);
  };

  const handleQuickMatch = async () => {
    if (!user) { router.push('/login'); return; }
    setQuickMatchLoading(true);
    try {
      const gameId = await createQuickMatch(user);
      router.push(`/game/${gameId}`);
    } catch {
      setQuickMatchLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = '/login?logout=true';
  };

  const overlayOpacity = lightMode ? 0.45 : 0.88;

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundImage: 'url(/noche.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <PageAudio track="menu" />

      {/* Capa oscura/clara base */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{ backgroundColor: lightMode ? `rgba(240,235,220,${overlayOpacity})` : `rgba(3,6,14,${overlayOpacity})` }}
      />

      {/* Glow rojo sutil en el centro */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 60% 40% at 50% 55%, rgba(140,20,20,0.18) 0%, transparent 70%)',
      }} />

      {/* Línea superior decorativa */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-800/50 to-transparent" />

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400/60 text-[10px] uppercase tracking-widest font-mono">En vivo</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            title={lightMode ? 'Modo noche' : 'Modo día'}
            className={`p-1.5 rounded-full transition-all ${lightMode ? 'bg-amber-400/20 text-amber-500' : 'bg-white/10 text-white/40 hover:text-white/70'}`}
          >
            {lightMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <AudioControls />
          {user ? (
            <>
              <span className={`text-xs hidden sm:block ${lightMode ? 'text-gray-600' : 'text-white/50'}`}>{user.displayName || user.email}</span>
              <button onClick={handleLogout} className={`text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${lightMode ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-white/15 text-white/90 hover:bg-white/25'}`}>
                <LogOut className="h-3.5 w-3.5" /> Salir
              </button>
            </>
          ) : (
            <Link href="/login" className={`text-xs transition-colors ${lightMode ? 'text-gray-600 hover:text-gray-900' : 'text-white/50 hover:text-white/80'}`}>
              Iniciar Sesión
            </Link>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 w-full max-w-lg mx-auto">

        {/* Logo */}
        <div className="relative mb-4">
          <Image
            src="/logo.png"
            alt="El Pueblo Duerme"
            width={90}
            height={90}
            className="rounded-full shadow-2xl"
            style={{ boxShadow: '0 0 40px rgba(180,30,30,0.4)' }}
            priority
          />
        </div>

        {/* Badge viral */}
        <div className="flex items-center gap-1.5 bg-red-950/70 border border-red-700/40 rounded-full px-3 py-1 mb-5">
          <Zap className="h-3 w-3 text-red-400" />
          <span className="text-red-300/90 text-[10px] uppercase tracking-widest font-semibold">35 roles · IA narradora · Chat de voz</span>
        </div>

        {/* Title */}
        <h1
          className="font-headline text-6xl md:text-7xl font-bold text-white leading-none tracking-tight mb-3"
          style={{
            textShadow: '0 0 60px rgba(200,30,30,0.5), 0 4px 30px rgba(0,0,0,0.9)',
          }}
        >
          El Pueblo<br />
          <span style={{ color: '#ff6b6b', textShadow: '0 0 40px rgba(255,80,80,0.6)' }}>Duerme</span>
        </h1>

        {/* Tagline */}
        <p className="text-white/60 text-sm max-w-xs mb-8 leading-relaxed font-serif italic">
          "Entre vosotros se esconde un lobo. La IA lo sabe. El pueblo no."
        </p>

        {/* CTA principal */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          {/* Botón Jugar Ahora (quick match) */}
          <button
            onClick={handleQuickMatch}
            disabled={quickMatchLoading}
            className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-black px-6 py-4 rounded-2xl text-base transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ boxShadow: '0 8px 30px rgba(220,50,30,0.35)' }}
          >
            {quickMatchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {quickMatchLoading ? 'Buscando partida…' : '⚡ Jugar Ahora'}
          </button>
          <p className="text-white/25 text-[10px] -mt-1">Con bots IA · Sin espera · Empieza solo</p>
          <Link
            href="/create"
            className="w-full bg-white/10 border border-white/20 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all active:scale-95 shadow-xl flex items-center justify-center gap-2"
          >
            <Sword className="h-4 w-4" />
            Crear Partida con Amigos
          </Link>
          <div className="flex gap-2 w-full">
            <Link
              href="/public-rooms"
              className="flex-1 bg-white/8 border border-white/12 text-white font-semibold px-4 py-3 rounded-xl text-sm transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Users className="h-3.5 w-3.5 text-white/60" />
              Públicas
            </Link>
            <button
              onClick={() => setShowJoinModal(true)}
              className="flex-1 bg-white/8 border border-white/12 text-white font-semibold px-4 py-3 rounded-xl text-sm transition-all active:scale-95"
            >
              Código
            </button>
          </div>
        </div>

        {/* Links secundarios */}
        <div className="flex items-center gap-5 mt-6 text-xs text-white/30">
          <button
            onClick={() => setShowTutorial(true)}
            className="hover:text-white/60 transition-colors flex items-center gap-1"
          >
            <Shield className="h-3 w-3" /> Cómo jugar
          </button>
          <Link href={user ? '/profile' : '/login'} className="hover:text-white/60 transition-colors">
            Mi Perfil
          </Link>
          <Link href="/store" className="text-yellow-500/60 hover:text-yellow-400 transition-colors flex items-center gap-1">
            <ShoppingBag className="h-3 w-3" /> Tienda
          </Link>
        </div>

        {/* Notificaciones push */}
        {user && pushGranted === false && (
          <button
            onClick={handleEnablePush}
            disabled={pushLoading}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-950/60 border border-indigo-700/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-900/60 transition-all disabled:opacity-50"
          >
            <Bell className="h-3.5 w-3.5 animate-pulse" />
            {pushLoading ? 'Activando…' : 'Activar notificaciones de partida'}
          </button>
        )}
        {user && pushGranted === true && (
          <div className="mt-4 flex items-center gap-2 text-xs text-white/25">
            <Bell className="h-3 w-3 text-green-500" />
            Notificaciones activas
          </div>
        )}

        {/* Carrusel de roles */}
        <RoleCarousel />

        {/* Propuesta de valor — 3 pillares */}
        <div className="grid grid-cols-3 gap-3 w-full mt-4">
          {[
            { icon: '🎙️', label: 'Voz en tiempo real', desc: 'Debate con tu voz' },
            { icon: '😈', label: 'Narrador IA', desc: 'Interrumpe e acusa' },
            { icon: '🌪️', label: 'Eventos de caos', desc: 'Reglas impredecibles' },
          ].map(f => (
            <div key={f.label} className="bg-white/5 border border-white/8 rounded-xl p-3 flex flex-col items-center gap-1">
              <span className="text-xl">{f.icon}</span>
              <span className="text-white/80 text-[10px] font-semibold leading-tight">{f.label}</span>
              <span className="text-white/30 text-[9px] leading-tight">{f.desc}</span>
            </div>
          ))}
        </div>

        {/* Banners publicitarios Adsterra */}
        <div className="mt-8 w-full space-y-4">
          <AdBanner format="horizontal" />
          <NativeBanner />
        </div>

        {/* Footer */}
        <footer className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[10px] text-white/20">
          <Link href="/privacy-policy" className="hover:text-white/40 transition-colors">Privacidad</Link>
          <Link href="/how-to-play" className="hover:text-white/40 transition-colors">Cómo Jugar</Link>
          <span>© {new Date().getFullYear()} El Pueblo Duerme</span>
        </footer>
      </div>

      {showJoinModal && <JoinByCodeModal onClose={() => setShowJoinModal(false)} />}
      {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
    </div>
  );
}
