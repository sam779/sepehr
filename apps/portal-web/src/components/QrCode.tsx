import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { renderQrToCanvas, qrToDataUrl } from '../lib/qr.js';

interface QrCodeProps {
  data: string;
  label?: string;
}

export default function QrCode({ data, label }: QrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    renderQrToCanvas(canvasRef.current, data).catch(() => setError(true));
  }, [data]);

  const handleDownload = async () => {
    try {
      const url = await qrToDataUrl(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${label ?? 'sepehr'}-qr.png`;
      a.click();
    } catch {
      // ignore
    }
  };

  if (error) {
    return (
      <div className="text-slate-400 text-sm">Failed to generate QR code.</div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-3 rounded-xl" style={{ background: '#0a0f1e' }}>
        <canvas ref={canvasRef} />
      </div>
      <button
        onClick={() => void handleDownload()}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}
      >
        <Download size={16} />
        Download PNG
      </button>
    </div>
  );
}
