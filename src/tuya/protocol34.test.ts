// npx tsx src/tuya/protocol34.test.ts — comprueba el protocolo 3.4 contra paquetes hechos con tinytuya
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromHex, toHex } from './protocol33';
import { decode34, dpsOf, encode34, handshake } from './protocol34';

const file = JSON.parse(readFileSync(new URL('../../tools/python/vectors-v34.json', import.meta.url), 'utf8'));

const hs = handshake(file.key, fromHex(file.localNonce));
assert.equal(toHex(hs.start(1)), file.step1, 'paso 1 de la negociación');
const { packet, sessionKey } = hs.finish(fromHex(file.step2), 2);
assert.equal(toHex(packet), file.step3, 'paso 3 de la negociación');
assert.equal(toHex(sessionKey), file.sessionKey, 'clave de sesión');
console.log('ok negociación');

for (const v of file.vectors) {
  assert.equal(toHex(encode34(sessionKey, v.cmd, v.seqno, v.payloadJson)), v.hex, `${v.name}: el paquete no coincide con tinytuya`);
  console.log('ok', v.name);
}

for (const v of file.incoming) {
  const m = decode34(sessionKey, fromHex(v.hex));
  assert.equal(m.crcOk, true, `${v.name}: firma`);
  assert.equal(m.cmd, v.cmd);
  assert.equal(m.retcode, 0);
  assert.equal(m.payload, v.json);
  assert.ok(dpsOf(m.payload)?.['1'] !== undefined);
  console.log('ok', v.name);
}

// con otra clave la firma no cuadra
assert.equal(decode34(new Uint8Array(16), fromHex(file.incoming[0].hex)).crcOk, false);
assert.throws(() => handshake('fedcba9876543210', fromHex(file.localNonce)).finish(fromHex(file.step2), 2));
console.log('ok claves equivocadas');
