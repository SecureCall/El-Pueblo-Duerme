'use client';

import { useEffect, useRef } from 'react';

type Format = 'horizontal' | 'rectangle' | 'native' | 'auto';

const BANNER_HORIZONTAL = { key: '030fe57e1377ceefff1e7b8e6230948f', width: 320, height: 50 };
const BANNER_RECTANGLE  = { key: '62e20b1b19b6fefc4b9795ed79a64fab', width: 300, height: 250 };
const NATIVE_ID  = '89281ae7ddac9aae2902aa7f47c54f2a';
const NATIVE_SRC = `https://pl29226127.profitablecpmratenetwork.com/${NATIVE_ID}/invoke.js`;

interface Props {
  format?: Format;
  className?: string;
  label?: string;
}

export function AdBanner({ format = 'horizontal', className = '', label = 'Publicidad' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const injected = useRef(false);

  useEffect(() => {
    if (injected.current || !containerRef.current) return;
    injected.current = true;

    const container = containerRef.current;

    if (format === 'native') {
      const script = document.createElement('script');
      script.async = true;
      script.dataset.cfasync = 'false';
      script.src = NATIVE_SRC;
      container.appendChild(script);

      const div = document.createElement('div');
      div.id = `container-${NATIVE_ID}`;
      container.appendChild(div);
    } else {
      const cfg = format === 'horizontal' ? BANNER_HORIZONTAL : BANNER_RECTANGLE;

      const optScript = document.createElement('script');
      optScript.innerHTML = `atOptions = { 'key': '${cfg.key}', 'format': 'iframe', 'height': ${cfg.height}, 'width': ${cfg.width}, 'params': {} };`;
      container.appendChild(optScript);

      const invokeScript = document.createElement('script');
      invokeScript.src = `https://www.highperformanceformat.com/${cfg.key}/invoke.js`;
      container.appendChild(invokeScript);
    }
  }, [format]);

  const minH = format === 'rectangle' || format === 'auto' ? 250 : format === 'native' ? 100 : 50;
  const maxW = format === 'horizontal' ? 320 : 300;

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      <p className="text-white/20 text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <div ref={containerRef} style={{ minHeight: minH, width: '100%', maxWidth: maxW }} />
    </div>
  );
}
