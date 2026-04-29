/**
 * TCP ↔ WebSocket tunnel.
 *
 * Once authentication and SSRF checks pass, createTunnel() opens a TCP
 * connection and pipes data bidirectionally between the TCP socket and the
 * upstream WebSocket (which came from the Cloudflare relay Worker).
 */

import * as net from 'node:net';
import type { WebSocket } from 'ws';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;  // 5 minutes
const HARD_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

export function createTunnel(
  ws: WebSocket,
  host: string,
  port: number,
): void {
  console.log(`[tcp] connecting  host=${host} port=${port}`);

  const tcp = net.connect(port, host);
  let bytesIn = 0;
  let bytesOut = 0;
  let idleHandle: ReturnType<typeof setTimeout>;

  const resetIdle = () => {
    clearTimeout(idleHandle);
    idleHandle = setTimeout(() => {
      console.log(`[tcp] idle timeout  host=${host} port=${port}`);
      cleanup('idle timeout');
    }, IDLE_TIMEOUT_MS);
  };
  resetIdle();

  const hardHandle = setTimeout(() => {
    console.log(`[tcp] hard timeout  host=${host} port=${port}`);
    cleanup('hard timeout');
  }, HARD_TIMEOUT_MS);

  const cleanup = (reason: string) => {
    clearTimeout(idleHandle);
    clearTimeout(hardHandle);
    console.log(
      `[tunnel] disconnect  host=${host} port=${port}` +
      ` reason="${reason}" bytesIn=${bytesIn} bytesOut=${bytesOut}`,
    );
    try { tcp.destroy(); } catch { /* already closed */ }
    try { ws.close(1000, reason); } catch { /* already closed */ }
  };

  // ── TCP events ──────────────────────────────────────────────────────────────

  tcp.once('connect', () => {
    console.log(`[tcp] connected  host=${host} port=${port}`);
    // Signal VPS-side readiness to Worker-side (not strictly necessary since
    // the Worker treats the first binary frame as the start of data, but we
    // send a JSON ack so the Worker knows the tunnel is live before piping).
    // The Worker is waiting for this before it starts forwarding client data.
    ws.send(JSON.stringify({ status: 'ok' }));
  });

  tcp.on('data', (chunk: Buffer) => {
    resetIdle();
    bytesOut += chunk.length;
    console.log(`[pipe tcp→ws]  bytes=${chunk.length}`);
    try {
      ws.send(chunk);
    } catch (e) {
      cleanup(`ws send error: ${e}`);
    }
  });

  tcp.on('end', () => {
    cleanup('tcp end');
  });

  tcp.on('error', (err: Error) => {
    console.error(`[tcp] error  host=${host} port=${port}  err=${err.message}`);
    cleanup(`tcp error: ${err.message}`);
  });

  tcp.on('close', () => {
    cleanup('tcp close');
  });

  // ── WebSocket events ────────────────────────────────────────────────────────

  ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
    resetIdle();
    let chunk: Buffer;
    if (Buffer.isBuffer(data)) {
      chunk = data;
    } else if (data instanceof ArrayBuffer) {
      chunk = Buffer.from(data);
    } else {
      // Buffer[] (fragmented)
      chunk = Buffer.concat(data as Buffer[]);
    }
    if (chunk.length === 0) return;
    bytesIn += chunk.length;
    console.log(`[pipe ws→tcp]  bytes=${chunk.length}`);
    if (!tcp.writable) {
      cleanup('tcp not writable');
      return;
    }
    tcp.write(chunk, (err) => {
      if (err) {
        console.error(`[tcp] write error: ${err.message}`);
        cleanup(`tcp write error: ${err.message}`);
      }
    });
  });

  ws.on('close', (code: number, reason: Buffer) => {
    cleanup(`ws close code=${code} reason=${reason.toString()}`);
  });

  ws.on('error', (err: Error) => {
    console.error(`[ws] error  err=${err.message}`);
    cleanup(`ws error: ${err.message}`);
  });
}
