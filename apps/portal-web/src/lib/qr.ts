/**
 * Client-side QR code generation using the `qrcode` npm package.
 * Renders to a canvas element or returns a data URL.
 */
import QRCode from 'qrcode';

export interface QrOptions {
  color?: { dark?: string; light?: string };
  width?: number;
}

// Black on white maximises contrast for all camera types and lighting conditions.
// Quiet zone margin=4 matches the ISO/IEC 18004 minimum and improves low-end camera scan rates.
const DEFAULT_OPTS: QrOptions = {
  color: { dark: '#000000', light: '#ffffff' },
  width: 300,
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
    margin: 4,
  });
}

export async function qrToDataUrl(data: string, opts?: QrOptions): Promise<string> {
  const merged = { ...DEFAULT_OPTS, ...opts };
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    width: merged.width,
    color: merged.color,
    margin: 4,
  });
}
