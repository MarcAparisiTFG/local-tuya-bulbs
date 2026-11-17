// La API de Philips (JointSpace 6) de la tele, para el Ambilight: HTTPS con el certificado propio de la tele y
// autenticación Digest con las credenciales del emparejamiento (tools/tv_pair.py). Va por una conexión TLS a
// mano porque ni fetch en el móvil ni el navegador aceptan ese certificado.
import { md5 } from '@noble/hashes/legacy.js';
import type { Look } from '../types';
import type { TlsConnect } from './cast';

export type TvCreds = { ip: string; user: string; pass: string };

/** Los colores fijos de Ambilight que acepta esta tele (un color hecho a mano no se queda). */
export type AmbilightPreset = 'HOT_LAVA' | 'DEEP_WATER' | 'FRESH_NATURE' | 'ISF' | 'PTA_LOUNGE';
export type AmbilightConfig = { styleName: string; isExpert?: boolean; menuSetting?: string; algorithm?: string };

const enc = new TextEncoder();
const dec = new TextDecoder();
const hex = (s: string) => Array.from(md5(enc.encode(s)), (b) => b.toString(16).padStart(2, '0')).join('');

/** El preset que más se parece a una luz. */
export function presetFor(l: Look): AmbilightPreset {
  if (l.mode === 'white') return l.temp < 50 ? 'ISF' : 'PTA_LOUNGE';
  const h = l.hue;
  if (h < 45 || h >= 300) return 'HOT_LAVA';
  if (h < 170) return 'FRESH_NATURE';
  return 'DEEP_WATER';
}

type Res = { status: number; headers: Record<string, string>; body: string };

function rawRequest(tls: TlsConnect, ip: string, method: string, path: string, body: string, auth?: string): Promise<Res> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let o = 0;
      for (const c of chunks) all.set(c, (o += c.length) - c.length);
      const text = dec.decode(all);
      const [head, ...rest] = text.split('\r\n\r\n');
      const lines = head.split('\r\n');
      const status = Number(lines[0].split(' ')[1]);
      const headers: Record<string, string> = {};
      for (const l of lines.slice(1)) {
        const i = l.indexOf(':');
        if (i > 0) headers[l.slice(0, i).toLowerCase()] = l.slice(i + 1).trim();
      }
      let payload = rest.join('\r\n\r\n');
      if (/chunked/i.test(headers['transfer-encoding'] ?? '')) {
        let out = '';
        for (let s = payload; s; ) {
          const nl = s.indexOf('\r\n');
          const size = parseInt(s.slice(0, nl), 16);
          if (!size) break;
          out += s.slice(nl + 2, nl + 2 + size);
          s = s.slice(nl + 2 + size + 2);
        }
        payload = out;
      }
      resolve({ status, headers, body: payload });
    };
    const timer = setTimeout(() => (chunks.length ? finish() : reject(new Error('La tele no contesta'))), 8000);
    const bytes = enc.encode(body);
    const req =
      `${method} ${path} HTTP/1.1\r\nHost: ${ip}:1926\r\nConnection: close\r\nContent-Type: application/json\r\n` +
      `Content-Length: ${bytes.length}\r\n${auth ? `Authorization: ${auth}\r\n` : ''}\r\n`;
    const sock = tls(ip, 1926, () => {
      sock.write(enc.encode(req));
      if (bytes.length) sock.write(bytes);
    });
    sock.on('data', (d) => {
      chunks.push(new Uint8Array(d));
      // con Content-Length sabemos cuándo ha llegado todo, sin esperar a que cierre
      const text = dec.decode(chunks[chunks.length - 1]);
      if (text.includes('\r\n0\r\n\r\n')) finish();
    });
    sock.on('error', (e) => (chunks.length ? finish() : reject(e)));
    (sock as unknown as { on(e: 'close', cb: () => void): void }).on('close', finish);
  });
}

/** Petición con Digest: la primera contesta 401 con el reto; la segunda va firmada. */
async function call(tls: TlsConnect, c: TvCreds, method: string, path: string, json?: object): Promise<string> {
  const body = json ? JSON.stringify(json) : '';
  const first = await rawRequest(tls, c.ip, method, path, body);
  if (first.status !== 401) return first.body;
  const challenge = first.headers['www-authenticate'] ?? '';
  const get = (k: string) => challenge.match(new RegExp(`${k}="([^"]*)"`))?.[1] ?? '';
  const realm = get('realm');
  const nonce = get('nonce');
  const qop = /qop="?auth/.test(challenge) ? 'auth' : '';
  const cnonce = Math.random().toString(16).slice(2, 10);
  const nc = '00000001';
  const ha1 = hex(`${c.user}:${realm}:${c.pass}`);
  const ha2 = hex(`${method}:${path}`);
  const response = qop ? hex(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : hex(`${ha1}:${nonce}:${ha2}`);
  const auth =
    `Digest username="${c.user}", realm="${realm}", nonce="${nonce}", uri="${path}", response="${response}"` +
    (qop ? `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"` : '') +
    (get('opaque') ? `, opaque="${get('opaque')}"` : '');
  const second = await rawRequest(tls, c.ip, method, path, body, auth);
  if (second.status >= 400) throw new Error(`La tele no deja cambiar el Ambilight (${second.status})`);
  return second.body;
}

export function createAmbilight(tls: TlsConnect, c: TvCreds) {
  return {
    get: async (): Promise<AmbilightConfig | null> => {
      const t = await call(tls, c, 'GET', '/6/ambilight/currentconfiguration');
      try {
        return t.trim() ? (JSON.parse(t) as AmbilightConfig) : null;
      } catch {
        return null;
      }
    },
    set: (cfg: AmbilightConfig) => call(tls, c, 'POST', '/6/ambilight/currentconfiguration', cfg).then(() => undefined),
    preset: (p: AmbilightPreset) =>
      call(tls, c, 'POST', '/6/ambilight/currentconfiguration', { styleName: 'FOLLOW_COLOR', isExpert: false, menuSetting: p }).then(() => undefined),
  };
}
