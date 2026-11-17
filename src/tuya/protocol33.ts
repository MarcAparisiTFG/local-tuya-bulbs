import { ecb } from '@noble/ciphers/aes.js';

// Protocolo local de Tuya 3.3: AES-128-ECB con la local_key, CRC32 y cabecera "3.3".
// Referencia: tinytuya (los vectores de prueba salen de ahí, ver tools/make_vectors.py).

export const CMD = {
  CONTROL: 0x07,
  STATUS: 0x08,
  HEART_BEAT: 0x09,
  DP_QUERY: 0x0a,
  UPDATE_DPS: 0x12,
} as const;

const PREFIX = 0x000055aa;
const SUFFIX = 0x0000aa55;
const VERSION_HEADER = new Uint8Array([0x33, 0x2e, 0x33, ...new Array(12).fill(0)]);
// Estos comandos viajan sin la cabecera "3.3"
const NO_HEADER_CMDS = new Set<number>([CMD.DP_QUERY, CMD.HEART_BEAT, CMD.UPDATE_DPS]);

const enc = new TextEncoder();
const dec = new TextDecoder();

let crcTable: Uint32Array | undefined;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of data) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function fromHex(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function keyBytes(localKey: string | Uint8Array): Uint8Array {
  const k = typeof localKey === 'string' ? enc.encode(localKey) : localKey;
  if (k.length !== 16) throw new Error('La local_key debe tener 16 caracteres');
  return k;
}

/** Monta un paquete 3.3 listo para mandar por TCP. `payloadJson` es el JSON en claro. */
export function encodeMessage(localKey: string, cmd: number, seqno: number, payloadJson: string): Uint8Array {
  const encrypted = ecb(keyBytes(localKey)).encrypt(enc.encode(payloadJson));
  const withHeader = NO_HEADER_CMDS.has(cmd)
    ? encrypted
    : Uint8Array.from([...VERSION_HEADER, ...encrypted]);

  const out = new Uint8Array(16 + withHeader.length + 8);
  const v = new DataView(out.buffer);
  v.setUint32(0, PREFIX);
  v.setUint32(4, seqno);
  v.setUint32(8, cmd);
  v.setUint32(12, withHeader.length + 8);
  out.set(withHeader, 16);
  v.setUint32(16 + withHeader.length, crc32(out.subarray(0, 16 + withHeader.length)));
  v.setUint32(20 + withHeader.length, SUFFIX);
  return out;
}

export type TuyaMessage = {
  seqno: number;
  cmd: number;
  retcode: number;
  /** JSON descifrado, o '' si el paquete no traía datos */
  payload: string;
  crcOk: boolean;
};

/** Lee un paquete 3.3 completo (de prefijo a sufijo). */
export function decodeMessage(localKey: string | Uint8Array, packet: Uint8Array, hasRetcode = true, plain = false): TuyaMessage {
  const v = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  if (v.getUint32(0) !== PREFIX) throw new Error('Prefijo incorrecto');
  const length = v.getUint32(12);
  const end = 16 + length;
  if (packet.length < end || v.getUint32(end - 4) !== SUFFIX) throw new Error('Paquete incompleto');

  const seqno = v.getUint32(4);
  const cmd = v.getUint32(8);
  const crcOk = crc32(packet.subarray(0, end - 8)) === v.getUint32(end - 8);
  // Las respuestas del dispositivo empiezan con un código de retorno; lo que enviamos nosotros no
  const retcode = hasRetcode ? v.getUint32(16) : 0;
  let data = packet.subarray(hasRetcode ? 20 : 16, end - 8);

  // Algunas respuestas llevan la cabecera "3.3" delante de los datos cifrados
  if (data.length >= 15 && data[0] === 0x33 && data[1] === 0x2e && data[2] === 0x33) data = data.subarray(15);

  const payload = !data.length ? '' : plain ? dec.decode(data) : dec.decode(ecb(keyBytes(localKey)).decrypt(data));
  return { seqno, cmd, retcode, payload, crcOk };
}

/** Longitud total del primer paquete en el buffer, o null si aún no ha llegado entero. */
export function packetLength(buf: Uint8Array): number | null {
  if (buf.length < 16) return null;
  const total = 16 + new DataView(buf.buffer, buf.byteOffset).getUint32(12);
  return buf.length >= total ? total : null;
}
