export type Look = {
  on: boolean;
  mode: 'white' | 'colour';
  /** 0-100. En modo color es el valor (V) del HSV. */
  brightness: number;
  /** 0 = cálido, 100 = frío */
  temp: number;
  /** 0-360 */
  hue: number;
  /** 0-100 */
  sat: number;
};

export type Bulb = {
  id: string;
  name: string;
  room: string;
  ip: string;
  key: string;
  /** Dónde está en el plano de casa (unidades de plan.ts); sin ella, va centrada en su habitación */
  pos?: { x: number; y: number };
};

/**
 * Una toma de enchufe. Cada toma es un aparato propio (con su nombre, su sitio y su interruptor), aunque las del
 * mismo enchufe compartan conexión y clave: el enchufe doble de Muvit tiene dos (DPS 1 y 2).
 */
export type Plug = {
  /** `${devId}:${dp}` */
  id: string;
  /** El enchufe Tuya al que pertenece */
  devId: string;
  /** El DPS de su interruptor ('1', '2'…) */
  dp: string;
  name: string;
  room: string;
  ip: string;
  key: string;
  /** Protocolo local del enchufe ('3.4'); sin él, 3.3 */
  version?: string;
  pos?: { x: number; y: number };
};

/**
 * Cómo pone la luz un modo:
 *  one   → la misma luz en todas sus bombillas
 *  each  → cada bombilla la suya (perBulb)
 *  party → colores al azar que la propia bombilla va cambiando sola (escena nativa, DPS 25)
 */
export type ModeKind = 'one' | 'each' | 'party';

export type Scene = {
  id: string;
  name: string;
  /** Dibujo de la escena: una clave de OBJ (objects.ts) o 'off' */
  icon: string;
  /** Escenas antiguas guardaban un emoji; ya no se usa */
  emoji?: string;
  /** Id de la persona dueña, o '*' si es de todos */
  owner: string;
  look: Look;
  /** 'all' o la lista de bombillas a las que se aplica */
  bulbIds: 'all' | string[];
  kind?: ModeKind;
  /** kind 'each': la luz de cada bombilla; las que no estén usan `look` */
  perBulb?: Record<string, Look>;
  /** kind 'party': 1 tranquila, 2 animada, 3 loca */
  speed?: 1 | 2 | 3;
  /** Qué tomas de enchufe enciende (true) o apaga (false); las que no estén, no se tocan */
  plugs?: Record<string, boolean>;
  /** Lo que pone en la tele: una app, o un vídeo de YouTube (id) copiado de lo que se veía en ella */
  tv?: { app?: string; youtube?: string; title?: string; /** el Ambilight del color de las luces */ ambilight?: boolean };
};

/** Un sitio al que vais a menudo: el widget y la pestaña Sitios enseñan cuánto se tarda en coche */
export type Place = { id: string; name: string; detail?: string; lat: number; lon: number; /** su logo, como data:image/png */ logo?: string };

export type Person = { id: string; name: string };

/** Un color guardado: tono 0-360 y saturación 0-100 */
export type SavedColor = { hue: number; sat: number };

export type Data = {
  bulbs: Bulb[];
  /** Las tomas de los enchufes (aparte de las bombillas: todo lo de luces sigue siendo sólo de bombillas) */
  plugs?: Plug[];
  scenes: Scene[];
  people: Person[];
  /** id de la persona que está usando la app */
  me: string;
  colors: SavedColor[];
  /** Modos de serie ya ofrecidos una vez (si se borran, no vuelven) */
  offered?: string[];
  places?: Place[];
  /** clave de TomTom para el mapa; llega del puente de casa y se recuerda */
  mapKey?: string;
  /** IP del puente de casa: la app compilada va a través de él cuando está encendido */
  hub?: string;
  /** La tele del salón */
  tv?: { ip: string; name: string; /** emparejamiento de la API de Philips (Ambilight); se trae del puente */ user?: string; pass?: string };
};
