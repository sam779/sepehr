/**
 * Client-side QR code generation using the `qrcode` npm package.
 * Renders to a canvas element or returns a data URL.
 */
import QRCode from 'qrcode';

export interface QrOptions {
  color?: { dark?: string; light?: string };
  width?: number;
}

const DEFAULT_OPTS: QrOptions = {
  color: { dark: '#06b6d4', light: '#0a0f1e' },
  width: 280,
};

export async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  data: string,
  opts?: QrOptions,
): Promise<void> {
  const merged = { ...DEFAULT_OPTS, ...opts };
  await QRCode.toCanvas(canvas, data, {
    errorCorrectionLevel: 'M',
    width: merged.width,
    color: merged.color,
    margin: 2,
  });
}

export async function qrToDataUrl(data: string, opts?: QrOptions): Promise<string> {
  const merged = { ...DEFAULT_OPTS, ...opts };
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    width: merged.width,
    color: merged.color,
    margin: 2,
  });
}
