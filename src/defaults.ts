import { Scene } from './types';

const s = (id: string, icon: string, name: string, look: Partial<Scene['look']>): Scene => ({
  id,
  icon,
  name,
  owner: '*',
  bulbIds: 'all',
  look: { on: true, mode: 'white', brightness: 100, temp: 40, hue: 30, sat: 100, ...look },
});

// Modos con tele: luces y, a la vez, algo en la tele Philips
const CHIMENEA: Scene = { ...s('chimenea', 'fire', 'Chimenea', { mode: 'colour', hue: 14, sat: 100, brightness: 22 }), tv: { youtube: 'cdKop6aixVE', title: 'Chimenea', ambilight: true } };
// sin vídeo de serie: el directo de Lofi Girl ya no está en YouTube; se elige el que guste desde la tele (editor)
const LOFI: Scene = s('lofi', 'headphone', 'Lofi', { mode: 'colour', hue: 268, sat: 70, brightness: 15 });

export const DEFAULT_SCENES: Scene[] = [
  CHIMENEA,
  LOFI,
  { ...s('fiesta', 'party', 'Fiesta loca', { mode: 'colour' }), kind: 'party', speed: 3 },
  s('lectura', 'book', 'Lectura', { brightness: 85, temp: 45 }),
  s('concentracion', 'focus', 'Concentración', { brightness: 100, temp: 100 }),
  s('cine', 'movie', 'Cine', { mode: 'colour', hue: 28, sat: 100, brightness: 12 }),
  s('romantico', 'rose', 'Romántico', { mode: 'colour', hue: 345, sat: 90, brightness: 25 }),
  s('noche', 'moon', 'Noche', { brightness: 6, temp: 0 }),
  s('apagar', 'off', 'Apagar todo', { on: false }),
];

/** Modos que llegan con una actualización: se ofrecen una vez a quien ya tenía datos guardados. */
export const NEW_SCENES: Scene[] = [{ ...s('fiesta', 'party', 'Fiesta loca', { mode: 'colour' }), kind: 'party', speed: 3 }, CHIMENEA, LOFI];


/** Dibujo para las escenas guardadas antes de que existiera `icon`. */
export const ICON_BY_ID: Record<string, string> = Object.fromEntries(DEFAULT_SCENES.map((x) => [x.id, x.icon]));
