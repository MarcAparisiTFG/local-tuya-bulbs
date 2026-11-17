// Entender una orden dicha (o escrita) en español: «chimenea», «apaga todo», «salón al 30», «luz roja en el
// dormitorio», «quita la fiesta», «pon Netflix». Es una función pura: no toca nada, sólo dice qué hacer.
import { planRoom, ROOMS } from '../plan';
import { TV_APPS } from '../tv/apps';
import type { Bulb, Look, Scene } from '../types';

export type Command =
  | { kind: 'scene'; scene: Scene; off: boolean }
  | { kind: 'power'; bulbs: Bulb[]; on: boolean; where: string }
  | { kind: 'look'; bulbs: Bulb[]; patch: Partial<Look>; where: string; what: string }
  | { kind: 'tv'; app: string; name: string }
  | { kind: 'unknown' };

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const has = (text: string, word: string) => new RegExp(`(^| )${word}( |$)`).test(text);

const COLORS: { words: string[]; name: string; patch: Partial<Look> }[] = [
  { words: ['blanco calido', 'blanca calida', 'calida', 'calido'], name: 'blanco cálido', patch: { mode: 'white', temp: 0 } },
  { words: ['blanco frio', 'blanca fria', 'fria', 'frio'], name: 'blanco frío', patch: { mode: 'white', temp: 100 } },
  { words: ['blanco', 'blanca', 'normal'], name: 'blanco', patch: { mode: 'white', temp: 45 } },
  { words: ['rojo', 'roja'], name: 'rojo', patch: { mode: 'colour', hue: 0, sat: 100 } },
  { words: ['naranja'], name: 'naranja', patch: { mode: 'colour', hue: 25, sat: 100 } },
  { words: ['amarillo', 'amarilla'], name: 'amarillo', patch: { mode: 'colour', hue: 50, sat: 100 } },
  { words: ['verde'], name: 'verde', patch: { mode: 'colour', hue: 120, sat: 100 } },
  { words: ['turquesa', 'cian'], name: 'turquesa', patch: { mode: 'colour', hue: 175, sat: 100 } },
  { words: ['azul'], name: 'azul', patch: { mode: 'colour', hue: 225, sat: 100 } },
  { words: ['morado', 'morada', 'violeta', 'lila', 'purpura'], name: 'morado', patch: { mode: 'colour', hue: 275, sat: 90 } },
  { words: ['rosa', 'rosado', 'rosada'], name: 'rosa', patch: { mode: 'colour', hue: 330, sat: 80 } },
];

const NUMBERS: Record<string, number> = { diez: 10, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, mitad: 50, medio: 50 };

export function parseCommand(raw: string, ctx: { scenes: Scene[]; bulbs: Bulb[] }): Command {
  const t = norm(raw);
  if (!t) return { kind: 'unknown' };
  const off = /\b(quita|quitar|para|parar|deten|detener|apaga|apagar|fuera)\b/.test(t);

  // 1) un modo por su nombre (el más largo que aparezca: «fiesta loca» antes que «fiesta»)
  const scene = [...ctx.scenes]
    .filter((s) => {
      const n = norm(s.name);
      const first = n.split(' ')[0];
      return t.includes(n) || (first.length > 3 && has(t, first));
    })
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (scene && !/^apagar? todo/.test(norm(scene.name))) return { kind: 'scene', scene, off: off && !/\b(pon|poner|activa|modo)\b/.test(t) };

  // 2) una app en la tele
  const app = TV_APPS.find((a) => has(t, norm(a.name).split(' ')[0]) || (a.key === 'prime' && has(t, 'amazon')));
  if (app && !/\b(luz|luces|bombilla)\b/.test(t)) return { kind: 'tv', app: app.key, name: app.name };

  // 3) dónde: una habitación o una bombilla por su nombre; si no, todas
  const room = ROOMS.find((r) => [norm(r.name), ...r.aliases].some((w) => has(t, w)));
  const bulb = ctx.bulbs.find((b) => norm(b.name).length > 2 && t.includes(norm(b.name)));
  const bulbs = bulb ? [bulb] : room ? ctx.bulbs.filter((b) => planRoom(b.room)?.id === room.id) : ctx.bulbs;
  const where = bulb ? bulb.name : room ? `el ${room.name.toLowerCase()}` : 'todas las luces';

  // 4) color o brillo
  const color = COLORS.find((c) => c.words.some((w) => t.includes(w)));
  const pct = t.match(/(\d{1,3})\s*(%|por ciento)?/)?.[1] ?? Object.entries(NUMBERS).find(([w]) => has(t, w))?.[1]?.toString();
  const brightness = pct ? Math.max(1, Math.min(100, Number(pct))) : /\b(tenue|bajita|baja|flojita|poca)\b/.test(t) ? 15 : /\b(maximo|tope|fuerte|toda)\b/.test(t) ? 100 : undefined;
  if (color || brightness !== undefined) {
    const patch: Partial<Look> = { on: true, ...(color?.patch ?? {}), ...(brightness !== undefined ? { brightness } : {}) };
    const what = [color?.name, brightness !== undefined ? `al ${brightness}%` : ''].filter(Boolean).join(' ');
    return { kind: 'look', bulbs, patch, where, what };
  }

  // 5) encender o apagar
  if (/\b(apaga|apagar|apagalo|apagala|apagalas)\b/.test(t)) return { kind: 'power', bulbs, on: false, where };
  if (/\b(enciende|encender|enciendelo|enciendela|enciendelas|prende|luz|luces)\b/.test(t)) return { kind: 'power', bulbs, on: true, where };

  return { kind: 'unknown' };
}
