'use client';

/**
 * WindowControlsOverlay
 *
 * When the PWA is installed with display_override: window-controls-overlay,
 * the browser removes the default title bar and exposes the
 * window.navigator.windowControlsOverlay API.
 *
 * This component renders a custom title bar that:
 *  - Stays out of the OS window-controls region (close / minimise / maximise)
 *  - Shows the game logo and current page title
 *  - Is drag-able (app-region: drag) so the user can move the window
 *  - Is invisible / zero-height when WCO is not active (normal browser tab)
 */

import { useEffect, useState } from 'react';

type Rect = { x: number; y: number; width: number; height: number };

function getTitleBarRect(): Rect | null {
  if (typeof window === 'undefined') return null;
  const wco = (navigator as any).windowControlsOverlay;
  if (!wco?.visible) return null;
  return wco.getTitlebarAreaRect?.() ?? null;
}

export function WindowControlsOverlay() {
  const [rect, setRect] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const wco = (navigator as any).windowControlsOverlay;
    if (!wco) return;

    const update = () => {
      setVisible(wco.visible ?? false);
      setRect(wco.getTitlebarAreaRect?.() ?? null);
    };

    update();
    wco.addEventListener('geometrychange', update);
    return () => wco.removeEventListener('geometrychange', update);
  }, []);

  if (!visible || !rect) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: rect.x,
        width: rect.width,
        height: rect.height,
        zIndex: 9999,
        WebkitAppRegion: 'drag',
        appRegion: 'drag',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '12px',
        paddingRight: '12px',
        backgroundColor: '#1c1917',
        userSelect: 'none',
        gap: '8px',
      } as React.CSSProperties}
    >
      {/* Logo icon */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/32.png"
        alt=""
        width={20}
        height={20}
        style={{ pointerEvents: 'none' }}
      />
      <span
        style={{
          color: '#fcd34d',
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.02em',
          pointerEvents: 'none',
          fontFamily: 'var(--font-headline, serif)',
        }}
      >
        El Pueblo Duerme
      </span>
    </div>
  );
}
