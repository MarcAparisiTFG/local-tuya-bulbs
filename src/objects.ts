// Objetos 3D de Microsoft Fluent Emoji (MIT, ver assets/3d/LICENSE-fluent-emoji.txt).
// Son imágenes de contenido (la bombilla, la habitación, la escena), no iconos de interfaz.
export const OBJ = {
  bulb: require('../assets/3d/bulb.png'),
  plug: require('../assets/3d/plug.png'),
  couch: require('../assets/3d/couch.png'),
  bed: require('../assets/3d/bed.png'),
  desk: require('../assets/3d/desk.png'),
  dinner: require('../assets/3d/dinner.png'),
  movie: require('../assets/3d/movie.png'),
  book: require('../assets/3d/book.png'),
  moon: require('../assets/3d/moon.png'),
  rose: require('../assets/3d/rose.png'),
  focus: require('../assets/3d/focus.png'),
  sun: require('../assets/3d/sun.png'),
  alien: require('../assets/3d/alien.png'),
  party: require('../assets/3d/party.png'),
  disco: require('../assets/3d/disco.png'),
  palette: require('../assets/3d/palette.png'),
  fire: require('../assets/3d/fire.png'),
  headphone: require('../assets/3d/headphone.png'),
  tv: require('../assets/3d/tv.png'),
} as const;

export type ObjKey = keyof typeof OBJ;

/** Lo que se puede elegir como dibujo de una escena; 'off' es el de apagar (un icono, no un objeto). */
export const SCENE_ICONS: (ObjKey | 'off')[] = ['fire', 'headphone', 'tv', 'party', 'disco', 'palette', 'sun', 'book', 'focus', 'dinner', 'movie', 'rose', 'moon', 'couch', 'bed', 'alien', 'off'];

export function roomObj(room: string): ObjKey {
  if (/sal[oó]n|living|comedor|sof[aá]/i.test(room)) return 'couch';
  if (/dormitorio|habitaci[oó]n|cuarto|mesilla|cama/i.test(room)) return 'bed';
  if (/estudio|despacho|oficina|escritorio/i.test(room)) return 'desk';
  if (/cocina/i.test(room)) return 'dinner';
  return 'bulb';
}
