'use client';

type Format = 'horizontal' | 'rectangle' | 'auto';

const BANNER_HORIZONTAL = { key: '030fe57e1377ceefff1e7b8e6230948f', width: 320, height: 50 };
const BANNER_RECTANGLE  = { key: '62e20b1b19b6fefc4b9795ed79a64fab', width: 300, height: 250 };

interface Props {
  format?: Format;
  className?: string;
  label?: string;
}

function SandboxedBanner({ adKey, width, height }: { adKey: string; width: number; height: number }) {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>body{margin:0;padding:0;overflow:hidden;}</style>
<script>atOptions={'key':'${adKey}','format':'iframe','height':${height},'width':${width},'params':{}};</script>
<script src="https://www.highperformanceformat.com/${adKey}/invoke.js"></script>
</head>
<body></body>
</html>`;

  return (
    <iframe
      srcDoc={html}
      width={width}
      height={height}
      scrolling="no"
      frameBorder="0"
      sandbox="allow-scripts"
      style={{ border: 'none', display: 'block', maxWidth: '100%' }}
      title="Publicidad"
    />
  );
}

export function AdBanner({ format = 'horizontal', className = '', label = 'Publicidad' }: Props) {
  const cfg = format === 'rectangle' ? BANNER_RECTANGLE : BANNER_HORIZONTAL;

  return (
    <div className={`w-full flex flex-col items-center ${className}`}>
      <p className="text-white/20 text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <SandboxedBanner adKey={cfg.key} width={cfg.width} height={cfg.height} />
    </div>
  );
}
