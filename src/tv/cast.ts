// Abrir una app en la tele por Google Cast (CASTV2): un CastMessage en protobuf dentro de una conexión TLS
// al puerto 8009. Sólo hace falta conectar y pedir LAUNCH; la app se queda abierta aunque cerremos.

/** Lo mínimo de una conexión TLS; encaja con node:tls y con react-native-tcp-socket. */
export interface TlsLike {
  on(event: 'data', cb: (d: Uint8Array) => void): unknown;
  on(event: 'error', cb: (e: Error) => void): unknown;
  write(d: Uint8Array): unknown;
  destroy(): unknown;
}
export type TlsConnect = (host: string, port: number, onConnect: () => void) => TlsLike;

const enc = new TextEncoder();
const dec = new TextDecoder();

function varint(n: number): number[] {
  const out: number[] = [];
  while (n > 127) {
    out.push((n & 127) | 128);
    n >>>= 7;
  }
  out.push(n);
  return out;
}

/** CastMessage: versión (1), origen (2), destino (3), canal (4), tipo de carga 0 = texto (5), carga (6). */
function castMessage(ns: string, payload: object, dest = 'receiver-0'): Uint8Array {
  const str = (field: number, s: string) => {
    const b = enc.encode(s);
    return [(field << 3) | 2, ...varint(b.length), ...b];
  };
  const body = [0x08, 0x00, ...str(2, 'sender-0'), ...str(3, dest), ...str(4, ns), 0x28, 0x00, ...str(6, JSON.stringify(payload))];
  const frame = new Uint8Array(4 + body.length);
  new DataView(frame.buffer).setUint32(0, body.length);
  frame.set(body, 4);
  return frame;
}

export function castLaunch(connect: TlsConnect, host: string, appId: string, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    let seen = '';
    const done = (err?: Error) => {
      clearTimeout(timer);
      try {
        sock.destroy();
      } catch {}
      err ? reject(err) : resolve();
    };
    const timer = setTimeout(() => done(new Error('La tele no ha abierto la app')), timeoutMs);
    const sock = connect(host, 8009, () => {
      sock.write(castMessage('urn:x-cast:com.google.cast.tp.connection', { type: 'CONNECT' }));
      sock.write(castMessage('urn:x-cast:com.google.cast.receiver', { type: 'LAUNCH', appId, requestId: 1 }));
    });
    sock.on('error', (e) => done(e));
    sock.on('data', (d) => {
      // no hace falta descodificar el protobuf: basta con ver el estado con nuestra app abierta
      seen = (seen + dec.decode(d)).slice(-8000);
      if (seen.includes(`"appId":"${appId}"`)) done();
      else if (seen.includes('LAUNCH_ERROR')) done(new Error('La tele no tiene esa app'));
    });
  });
}
