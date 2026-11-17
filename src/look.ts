import { hsvToHex, parseColor } from 'panelui-native';
import { Look, Scene } from './types';
import { sceneLookFor } from './lightCore';

export * from './lightCore';

/** Color CSS de un HSV (tono 0-360, saturación y valor 0-100). */
export function hsvCss(h: number, s: number, v = 100): string {
  const S = s / 100;
  const V = v / 100;
  const l = V * (1 - S / 2);
  const sl = l === 0 || l === 1 ? 0 : (V - l) / Math.min(l, 1 - l);
  return `hsl(${Math.round(h)}, ${Math.round(sl * 100)}%, ${Math.round(l * 100)}%)`;
}

const mixRgb = (a: number[], b: number[], t: number) => `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(', ')})`;

/** Blanco de cálido (0) a frío (100), aproximado para la pantalla. */
export const tempCss = (t: number) => mixRgb([255, 176, 102], [156, 195, 255], t / 100);

/** La luz que da la bombilla, a tope: para el halo, el dial y el punto de color. */
export const lookCss = (l: Look) => (!l.on ? '#C9C3D3' : l.mode === 'colour' ? hsvCss(l.hue, Math.max(l.sat, 8)) : tempCss(l.temp));

/** El fondo pastel de una tarjeta: la luz de su bombilla muy aclarada (DESIGN.md, «live pastels»). */
export function lookPastel(l: Look): string {
  if (!l.on) return '#ECE9F1';
  if (l.mode === 'colour') return `hsl(${Math.round(l.hue)}, ${Math.round(30 + 0.45 * l.sat)}%, 88%)`;
  return mixRgb([252, 227, 207], [221, 235, 251], l.temp / 100);
}

/** Palabra para la temperatura del blanco. */
export const tempWord = (t: number) => (t < 33 ? 'Cálida' : t < 66 ? 'Neutra' : 'Fría');

/** Un color (tono 0-360, saturación 0-100) como #rrggbb a brillo máximo: lo que entiende la rueda de color. */
export const colourHex = (hue: number, sat: number) => hsvToHex(hue, sat / 100, 1);

/** Tono y saturación de un #rrggbb. El brillo no se saca de aquí: va en su propio deslizador. */
export function hexToColour(hex: string): Pick<Look, 'hue' | 'sat'> | null {
  const c = parseColor(hex);
  if (!c) return null;
  return { hue: Math.round(c.h) % 360, sat: Math.round(c.s * 100) };
}

/** Los colores que representan un modo, para pintar su tarjeta. */
export function sceneSwatches(s: Scene, bulbIds: string[]): string[] {
  if (s.kind === 'party') return ['hsl(330, 80%, 86%)', 'hsl(50, 85%, 84%)', 'hsl(170, 60%, 84%)', 'hsl(260, 70%, 88%)'];
  if (s.kind === 'each') {
    const all = [...new Set(bulbIds.map((id) => lookPastel(sceneLookFor(s, id))))];
    return all.length ? all : [lookPastel(s.look)];
  }
  return [lookPastel(s.look)];
}
