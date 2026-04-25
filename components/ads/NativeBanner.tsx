'use client';

import { useEffect, useRef } from 'react';

const NATIVE_KEY = '89281ae7ddac9aae2902aa7f47c54f2a';
const NATIVE_SRC = `https://pl29226127.profitablecpmratenetwork.com/${NATIVE_KEY}/invoke.js`;

interface Props {
  className?: string;
}

export function NativeBanner({ className = '' }: Props) {
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current) return;
    injected.current = true;

    if (document.querySelector(`script[src="${NATIVE_SRC}"]`)) return;

    const s = document.createElement('script');
    s.async = true;
    s.setAttribute('data-cfasync', 'false');
    s.src = NATIVE_SRC;
    document.body.appendChild(s);
  }, []);

  return (
    <div className={`w-full ${className}`}>
      <p className="text-white/20 text-[10px] uppercase tracking-widest text-center mb-1">Publicidad</p>
      <div id={`container-${NATIVE_KEY}`} className="w-full" />
    </div>
  );
}
