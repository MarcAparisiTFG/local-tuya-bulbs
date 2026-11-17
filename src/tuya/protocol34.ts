import { ecb } from '@noble/ciphers/aes.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import type { TuyaMessage } from './protocol33';

// Protocolo local de Tuya 3.4 (el del enchufe): al conectar se negocia una clave de sesión a partir de la
// local_key; luego todo va cifrado con ella (AES-128-ECB) y firmado con HMAC-SHA256 en vez de CRC32.
// La cabecera "3.4" va dentro de lo cifrado. Vectores de prueba: tools/make_vectors_v34.py (tinytuya).

export const CMD34 = {
  SESS_KEY_NEG_START: 0x03,
  SESS_KEY_NEG_RESP: 0x04,
  SESS_KEY_NEG_FINISH: 0x05,
  STATUS: 0x08,
  HEART_BEAT: 0x09,
  CONTROL_NEW: 0x0d,
  DP_QUERY_NEW: 0x10,
  UPDATE_DPS: 0x12,
} as const;

const PREFIX = 0x000055aa;
const SUFFIX = 0x0000aa55;
const VERSION_HEADER = new Uint8Array([0x33, 0x2e, 0x34, ...new Array(12).fill(0)]);
// Estos comandos viajan sin la cabecera "3.4"
const NO_HEADER_CMDS = new Set<number>([
  0x0a,
  CMD34.DP_QUERY_NEW,
  CMD34.UPDATE_DPS,
  CMD34.HEART_BEAT,
  CMD34.SESS_KEY_NEG_START,
  CMD34.SESS_KEY_NEG_RESP,
  CMD34.SESS_KEY_NEG_FINISH,
]);

const enc = new TextEncoder();
const dec = new TextDecoder();

export const keyOf = (k: string | Uint8Array): Uint8Array => {
  const b = typeof k === 'string' ? enc.encode(k) : k;
  if (b.length !== 16) throw new Error('La local_key debe tener 16 caracteres');
  return b;
};

const sign = (key: Uint8Array, data: Uint8Array) => hmac(sha256, key, data);

const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Monta un paquete 3.4. `body` es el JSON en claro o, en la negociación, los bytes tal cual. */
export function encode34(key: Uint8Array, cmd: number, seqno: number, body: string | Uint8Array): Uint8Array {
  const clear = typeof body === 'string' ? enc.encode(body) : body;
  const withHeader = NO_HEADER_CMDS.has(cmd) ? clear : Uint8Array.from([...VERSION_HEADER, ...clear]);
  const data = ecb(key).encrypt(withHeader);

  const out = new Uint8Array(16 + data.length + 32 + 4);
  const v = new DataView(out.buffer);
  v.setUint32(0, PREFIX);
  v.setUint32(4, seqno);
  v.setUint32(8, cmd);
  v.setUint32(12, data.length + 36);
  out.set(data, 16);
  out.set(sign(key, out.subarray(0, 16 + data.length)), 16 + data.length);
  v.setUint32(out.length - 4, SUFFIX);
  return out;
}

export type TuyaMessage34 = TuyaMessage & { bytes: Uint8Array };

/** Lee un paquete 3.4 completo que manda el aparato (de prefijo a sufijo). */
export function decode34(key: Uint8Array, packet: Uint8Array): TuyaMessage34 {
  const v = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  if (v.getUint32(0) !== PREFIX) throw new Error('Prefijo incorrecto');
  const end = 16 + v.getUint32(12);
  if (packet.length < end || end < 52 || v.getUint32(end - 4) !== SUFFIX) throw new Error('Paquete incompleto');

  const crcOk = same(sign(key, packet.subarray(0, end - 36)), packet.subarray(end - 36, end - 4));
  let data = packet.subarray(16, end - 36);
  // lo cifrado ocupa siempre bloques de 16: si sobran 4 bytes delante, son el código de retorno
  let retcode = 0;
  if (data.length % 16 === 4) {
    retcode = v.getUint32(16);
    data = data.subarray(4);
  }
  let bytes = data.length && crcOk ? ecb(key).decrypt(data) : new Uint8Array(0);
  if (bytes.length >= 15 && bytes[0] === 0x33 && bytes[1] === 0x2e && bytes[2] === 0x34) bytes = bytes.subarray(15);
  return { seqno: v.getUint32(4), cmd: v.getUint32(8), retcode, payload: dec.decode(bytes), crcOk, bytes };
}

/** Los DPS de una respuesta 3.4: vienen en `dps` o, en los avisos, en `data.dps`. */
export function dpsOf(payload: string): Record<string, string | number | boolean> | null {
  if (!payload) return null;
  const j = JSON.parse(payload);
  return j.dps ?? j.data?.dps ?? null;
}

function randomNonce(): Uint8Array {
  const n = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(n);
  else for (let i = 0; i < 16; i++) n[i] = Math.floor(Math.random() * 256);
  return n;
}

/**
 * La negociación de la clave de sesión, en tres pasos:
 *  1. mandamos un nonce nuestro (`start`)
 *  2. el aparato contesta con el suyo y la firma del nuestro (`finish` lo comprueba)
 *  3. le mandamos la firma del suyo; la clave de sesión sale de los dos nonces
 */
export function handshake(localKey: string, nonce = randomNonce()) {
  const key = keyOf(localKey);
  return {
    start: (seqno: number) => encode34(key, CMD34.SESS_KEY_NEG_START, seqno, nonce),
    /** Recibe la respuesta del paso 2; devuelve el paquete del paso 3 y la clave de la sesión. */
    finish(reply: Uint8Array, seqno: number): { packet: Uint8Array; sessionKey: Uint8Array } {
      const m = decode34(key, reply);
      if (m.cmd !== CMD34.SESS_KEY_NEG_RESP || !m.crcOk || m.bytes.length < 48) throw new Error('El aparato no acepta la clave local');
      const remote = m.bytes.slice(0, 16);
      if (!same(sign(key, nonce), m.bytes.subarray(16, 48))) throw new Error('El aparato no acepta la clave local');
      const xored = nonce.map((b, i) => b ^ remote[i]);
      return {
        packet: encode34(key, CMD34.SESS_KEY_NEG_FINISH, seqno, sign(key, remote)),
        sessionKey: ecb(key, { disablePadding: true }).encrypt(xored),
      };
    },
  };
}
