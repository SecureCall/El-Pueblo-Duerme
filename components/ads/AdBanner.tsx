'use client';

import { useEffect, useRef } from 'react';

type Format = 'horizontal' | 'rectangle' | 'auto';

const BANNER_HORIZONTAL = { key: '030fe57e1377ceefff1e7b8e6230948f', width: 320, height: 50 };
const BANNER_RECTANGLE  = { key: '62e20b1b19b6fefc4b9795ed79a64fab', width: 300, height: 250 };

interface Props {
  format?: Format;
  className?: string;
  label?: string;
}

function AdScript({ adKey, width, height }: { adKey: string; width: number; height: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (!containerRef.current || injected.current) return;
    injected.current = true;

    const container = containerRef.current;
    container.innerHTML = '';

    const optionsScript = document.createElement('script');
    optionsScript.type = 'text/javascript';
    optionsScript.text = `atOptions = {'key':'${adKey}','format':'iframe','height':${height},'width':${width},'params':{}};`;
    container.appendChild(optionsScript);

    const invokeScript = document.createElement('script');
    invokeScript.type = 'text/javascript';
    invokeScript.src = `https://www.highperformanceformat.com/${adKey}/invoke.js`;
    invokeScript.async = true;
    container.appendChild(invokeScript);
  }, [adKey, width, height]);

  return (
    <div
      ref={containerRef}
      style={{ width, height, maxWidth: '100%', overflow: 'hidden' }}
    />
  );
}

export function AdBanner({ format = 'horizontal', className = '', label = 'Publicidad' }: Props) {
  const cfg = format === 'rectangle' ? BANNER_RECTANGLE : BANNER_HORIZONTAL;

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      <p className="text-white/20 text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <AdScript adKey={cfg.key} width={cfg.width} height={cfg.height} />
    </div>
  );
}
