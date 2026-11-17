// El plano de casa (un piso de ejemplo): cámbialo por el tuyo. Unidades del boceto (1174 × 684); el componente
// HousePlan lo escala al ancho de la pantalla. Las bombillas van a una habitación por su campo `room`.

export const PLAN_W = 1174;
export const PLAN_H = 684;

export type PlanRoom = {
  id: string;
  name: string;
  /** Otras formas de escribirla en `room` (sin tildes ni mayúsculas) */
  aliases: string[];
  x: number;
  y: number;
  w: number;
  h: number;
};

export const ROOMS: PlanRoom[] = [
  { id: 'despacho', name: 'Despacho', aliases: ['estudio', 'oficina', 'escritorio'], x: 0, y: 0, w: 390, h: 319 },
  { id: 'bano2', name: 'Baño 2', aliases: ['bano pequeno', 'aseo'], x: 390, y: 0, w: 152, h: 122 },
  { id: 'bano1', name: 'Baño 1', aliases: ['bano', 'bano grande'], x: 542, y: 0, w: 308, h: 125 },
  { id: 'pasillo', name: 'Pasillo', aliases: ['distribuidor'], x: 390, y: 122, w: 460, h: 197 },
  { id: 'dormitorio', name: 'Dormitorio', aliases: ['habitacion', 'cuarto', 'mesilla', 'cama'], x: 850, y: 0, w: 324, h: 319 },
  { id: 'cocina', name: 'Cocina', aliases: [], x: 0, y: 319, w: 320, h: 266 },
  { id: 'entrada', name: 'Entrada', aliases: ['recibidor', 'puerta'], x: 0, y: 585, w: 320, h: 99 },
  { id: 'salon', name: 'Salón', aliases: ['comedor', 'living', 'sofa', 'tele'], x: 320, y: 319, w: 854, h: 365 },
];

/** Muebles, sólo para que el plano se lea como una casa. `r` es el redondeo. */
export const FURNITURE: { name: string; x: number; y: number; w: number; h: number; r: number }[] = [
  { name: 'Escritorio', x: 40, y: 14, w: 186, h: 88, r: 36 },
  { name: 'Escritorio', x: 14, y: 116, w: 66, h: 112, r: 30 },
  { name: 'Mueble', x: 10, y: 268, w: 316, h: 26, r: 8 },
  { name: 'Cama', x: 896, y: 16, w: 228, h: 252, r: 14 },
  { name: 'Barra', x: 320, y: 319, w: 46, h: 218, r: 8 },
  { name: 'Sofá', x: 668, y: 330, w: 436, h: 100, r: 26 },
  { name: 'Tele', x: 712, y: 650, w: 350, h: 22, r: 6 },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** La habitación del plano que corresponde al texto `room` de una bombilla, si la hay. */
export function planRoom(room: string): PlanRoom | undefined {
  const r = norm(room);
  if (!r) return undefined;
  return ROOMS.find((x) => norm(x.name) === r || x.id === r || x.aliases.includes(r));
}

/** La habitación en la que cae un punto del plano. */
export const roomAt = (x: number, y: number) => ROOMS.find((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
