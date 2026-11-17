// La parte de la luz que no depende de la pantalla: la usan la app y el puente de casa (tools/).
import { Dps } from './tuya/device';
import { hsvHex } from './tuya/bulb';
import { Look, Scene } from './types';

export const DEFAULT_LOOK: Look = { on: true, mode: 'white', brightness: 100, temp: 40, hue: 30, sat: 100 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Traduce un aspecto al conjunto de DPS (bombillas v2) que hay que mandar. */
export function lookToDps(l: Look): Dps {
  if (!l.on) return { '20': false };
  if (l.mode === 'colour') return { '20': true, '21': 'colour', '24': hsvHex(l.hue, l.sat, clamp(l.brightness, 1, 100)) };
  return {
    '20': true,
    '21': 'white',
    '22': Math.round(10 + (clamp(l.brightness, 0, 100) / 100) * 990),
    '23': Math.round(clamp(l.temp, 0, 100) * 10),
  };
}

const hex4 = (n: number) => Math.round(n).toString(16).padStart(4, '0');

/** Lo contrario: pone al día un aspecto con los DPS que manda la bombilla. */
export function mergeDps(prev: Look, dps: Dps): Look {
  const l = { ...prev };
  if (typeof dps['20'] === 'boolean') l.on = dps['20'];
  if (dps['21'] === 'colour') l.mode = 'colour';
  else if (dps['21'] === 'white') l.mode = 'white';
  if (typeof dps['23'] === 'number') l.temp = dps['23'] / 10;
  const hex = dps['24'];
  if (typeof hex === 'string' && hex.length === 12) {
    l.hue = parseInt(hex.slice(0, 4), 16);
    l.sat = parseInt(hex.slice(4, 8), 16) / 10;
    if (l.mode === 'colour') l.brightness = parseInt(hex.slice(8, 12), 16) / 10;
  }
  if (typeof dps['22'] === 'number' && l.mode === 'white') l.brightness = ((dps['22'] - 10) / 990) * 100;
  return l;
}

export const lookFromDps = (dps: Dps) => mergeDps(DEFAULT_LOOK, dps);

/**
 * ¿La luz de una bombilla es la que pone la escena? Con un poco de margen: la bombilla redondea lo que recibe.
 * Así una escena se ve activa mientras sea verdad, y deja de estarlo en cuanto alguien toca la luz.
 */
export function lookMatches(l: Look, scene: Look): boolean {
  if (!scene.on) return !l.on;
  if (!l.on || l.mode !== scene.mode || Math.abs(l.brightness - scene.brightness) > 2) return false;
  if (scene.mode === 'white') return Math.abs(l.temp - scene.temp) <= 2;
  const dh = Math.abs(l.hue - scene.hue) % 360;
  return Math.min(dh, 360 - dh) <= 3 && Math.abs(l.sat - scene.sat) <= 3;
}

/** Marca de nuestras escenas de fiesta: el número de escena 8 (las de la app de Tuya usan otros). */
export const PARTY_MARK = '08';
// Lo que tarda cada tramo (en las unidades de la bombilla); cuanto menos, más loca
const SPEED = { 1: 70, 2: 35, 3: 10 } as const;

/**
 * Una fiesta para una bombilla: 8 colores dando la vuelta a la rueda, y la bombilla funde de uno al siguiente
 * (modo 02), así que pasa por todos los colores intermedios en vez de saltar. Cada bombilla empieza en un color
 * y gira en un sentido al azar, para que no vayan todas iguales.
 * Formato de scene_data_v2 (DPS 25): nº de escena + por color: tiempo de cambio, de fundido, modo, tono,
 * saturación, valor, brillo y temperatura.
 */
export function partyScene(speed: 1 | 2 | 3 = 3): string {
  const t = SPEED[speed].toString(16).padStart(2, '0');
  const start = Math.random() * 360;
  const dir = Math.random() < 0.5 ? 1 : -1;
  let units = '';
  for (let i = 0; i < 8; i++) {
    const h = (((start + dir * i * 45) % 360) + 360) % 360;
    units += t + t + '02' + hex4(h) + hex4(1000) + hex4(1000) + hex4(0) + hex4(0);
  }
  return PARTY_MARK + units;
}

/** La luz que pone un modo en una bombilla concreta. */
export const sceneLookFor = (s: Scene, bulbId: string): Look => (s.kind === 'each' ? s.perBulb?.[bulbId] ?? s.look : s.look);
