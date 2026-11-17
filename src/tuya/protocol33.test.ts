import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeMessage, encodeMessage, fromHex, toHex } from './protocol33';

const file = JSON.parse(readFileSync(new URL('../../tools/python/vectors-v33.json', import.meta.url), 'utf8'));

for (const v of file.vectors) {
  const mine = toHex(encodeMessage(file.key, v.cmd, v.seqno, v.payloadJson));
  assert.equal(mine, v.hex, `${v.name}: el paquete no coincide con tinytuya`);

  const back = decodeMessage(file.key, fromHex(v.hex), false);
  assert.equal(back.cmd, v.cmd);
  assert.equal(back.seqno, v.seqno);
  assert.equal(back.crcOk, true);
  console.log('ok', v.name);
}
