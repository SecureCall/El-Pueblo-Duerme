'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function ShareTargetHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const title = searchParams.get('title') || '';
    const text = searchParams.get('text') || '';
    const url = searchParams.get('url') || '';

    const combined = `${title} ${text} ${url}`.trim();

    const roomCodeMatch = combined.match(/[A-Z0-9]{6}/);
    const joinMatch = combined.match(/\/join\/([A-Z0-9]{6})/i)
      || combined.match(/[?&]room=([A-Z0-9]{6})/i)
      || combined.match(/[?&]code=([A-Z0-9]{6})/i);

    const code = joinMatch?.[1]?.toUpperCase() || roomCodeMatch?.[0]?.toUpperCase();

    if (code) {
      router.replace(`/join?code=${code}`);
    } else if (url && url.includes('/join/')) {
      try {
        const parsed = new URL(url);
        router.replace(parsed.pathname + parsed.search);
      } catch {
        router.replace('/join');
      }
    } else {
      router.replace('/join');
    }
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-amber-100">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-lg font-medium">Cargando invitación…</p>
      </div>
    </div>
  );
}

export default function ShareTargetPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ShareTargetHandler />
    </Suspense>
  );
}
