import { md5 } from '@noble/hashes/legacy.js';
import { decodeMessage } from './protocol33';

export type Found = { ip: string; gwId: string; version: string };

// Las bombillas anuncian su ID e IP cada pocos segundos por UDP (6666 sin cifrar y 6667 cifrado con una
// clave fija y pública). Nunca anuncian la local_key.
const UDP_KEY = md5(new TextEncoder().encode('yGAdlopoPVldABfn'));

export interface UdpSocket {
  bind(port: number): unknown;
  on(event: 'message', cb: (data: Uint8Array) => void): unknown;
  on(event: 'error', cb: (e: Error) => void): unknown;
  close(): unknown;
}

/** Escucha anuncios `ms` milisegundos y devuelve las bombillas vistas. */
export function discoverWith(create: () => UdpSocket, ms = 6000): Promise<Found[]> {
  return new Promise((resolve) => {
    const found = new Map<string, Found>();
    const sockets: UdpSocket[] = [];
    for (const port of [6666, 6667]) {
      try {
        const s = create();
        s.on('error', () => {});
        s.on('message', (data) => {
          try {
            const msg = decodeMessage(UDP_KEY, new Uint8Array(data), true, port === 6666);
            const info = JSON.parse(msg.payload);
            if (info.gwId && info.ip) found.set(info.gwId, { ip: info.ip, gwId: info.gwId, version: info.version ?? '' });
          } catch {}
        });
        s.bind(port);
        sockets.push(s);
      } catch {}
    }
    setTimeout(() => {
      sockets.forEach((s) => {
        try {
          s.close();
        } catch {}
      });
      resolve([...found.values()]);
    }, ms);
  });
}
