import assert from 'node:assert/strict';
import { DEFAULT_SCENES } from '../defaults';
import type { Bulb } from '../types';
import { parseCommand } from './commands';

const bulbs: Bulb[] = [
  { id: 'a', name: 'Bombilla muvit', room: 'Salón', ip: '', key: '' },
  { id: 'b', name: 'Mesilla', room: 'Dormitorio', ip: '', key: '' },
];
const ctx = { scenes: DEFAULT_SCENES, bulbs };
const cases: [string, (c: ReturnType<typeof parseCommand>) => boolean][] = [
  ['Chimenea', (c) => c.kind === 'scene' && c.scene.id === 'chimenea' && !c.off],
  ['pon el modo chimenea', (c) => c.kind === 'scene' && c.scene.id === 'chimenea' && !c.off],
  ['quita la chimenea', (c) => c.kind === 'scene' && c.scene.id === 'chimenea' && c.off],
  ['modo fiesta', (c) => c.kind === 'scene' && c.scene.id === 'fiesta'],
  ['Apaga todo', (c) => c.kind === 'power' && !c.on && c.bulbs.length === 2],
  ['apaga el salón', (c) => c.kind === 'power' && !c.on && c.bulbs.length === 1 && c.bulbs[0].id === 'a'],
  ['enciende las luces', (c) => c.kind === 'power' && c.on && c.bulbs.length === 2],
  ['salón al 30', (c) => c.kind === 'look' && c.patch.brightness === 30 && c.bulbs[0].id === 'a'],
  ['pon la luz roja en el dormitorio', (c) => c.kind === 'look' && c.patch.hue === 0 && c.bulbs[0].id === 'b'],
  ['luz azul al cincuenta por ciento', (c) => c.kind === 'look' && c.patch.hue === 225 && c.patch.brightness === 50],
  ['luz cálida tenue', (c) => c.kind === 'look' && c.patch.mode === 'white' && c.patch.temp === 0 && c.patch.brightness === 15],
  ['pon Netflix', (c) => c.kind === 'tv' && c.app === 'netflix'],
  ['abre Disney', (c) => c.kind === 'tv' && c.app === 'disney'],
  ['pon Amazon', (c) => c.kind === 'tv' && c.app === 'prime'],
  ['qué hora es', (c) => c.kind === 'unknown'],
];
let ok = 0;
for (const [text, check] of cases) {
  const c = parseCommand(text, ctx);
  if (check(c)) ok++;
  else console.log('FALLA', JSON.stringify(text), '→', JSON.stringify({ ...c, bulbs: undefined, scene: undefined, sceneId: (c as { scene?: { id: string } }).scene?.id }));
}
console.log(`${ok}/${cases.length} órdenes entendidas`);
assert.equal(ok, cases.length);
