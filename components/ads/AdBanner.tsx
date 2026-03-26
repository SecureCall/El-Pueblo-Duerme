'use client';

import { useEffect, useRef } from 'react';

interface Props {
  slot?: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  className?: string;
  label?: string;
}

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export function AdBanner({ slot = '', format = 'auto', className = '', label = 'Publicidad' }: Props) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      pushed.current = true;
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (_) {}
  }, []);

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      <p className="text-white/20 text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', minWidth: 300, minHeight: 90 }}
        data-ad-client="ca-pub-4807272408824742"
        data-ad-slot={slot || undefined}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
