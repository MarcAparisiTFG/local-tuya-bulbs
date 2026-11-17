import AsyncStorage from '@react-native-async-storage/async-storage';
import { toast } from 'panelui-native';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DEFAULT_SCENES, ICON_BY_ID, NEW_SCENES } from './defaults';
import { Found } from './tuya/discovery';
import { HAS_TCP } from './tuya/sockets';
import { BridgeBulb, BridgePlug, detectMode, getMode } from './tuya/mode';
import { isBulbDevice, isPlugDevice, outletsOf, RawDevice } from './plugs';
import { Bulb, Data, Place, Plug, SavedColor, Scene } from './types';

// Cada modo guarda aparte, para no mezclar bombillas simuladas, las del puente y las de la app compilada.
// La compilada guarda siempre en el mismo sitio, vaya directa o a través del puente de casa.
const storageKey = () => (HAS_TCP ? 'marsianapp-v1' : { native: 'marsianapp-v1', bridge: 'marsianapp-bridge-v1', demo: 'marsianapp-demo-v1' }[getMode()]);
const uid = () => Math.random().toString(36).slice(2, 9);

const DEMO: Bulb[] = [
  { id: 'demo-salon', name: 'Salón', room: 'Salón', ip: 'demo', key: 'demo' },
  { id: 'demo-dormitorio', name: 'Mesilla', room: 'Dormitorio', ip: 'demo', key: 'demo' },
  { id: 'demo-escritorio', name: 'Escritorio', room: 'Estudio', ip: 'demo', key: 'demo' },
];

const DEMO_PLUGS: Plug[] = [{ id: 'demo-enchufe:1', devId: 'demo-enchufe', dp: '1', name: 'Enchufe', room: 'Salón', ip: 'demo', key: 'demo' }];

const initial = (): Data => ({
  bulbs: getMode() === 'demo' ? DEMO : [],
  plugs: getMode() === 'demo' ? DEMO_PLUGS : [],
  scenes: DEFAULT_SCENES,
  people: [{ id: 'yo', name: 'Yo' }],
  me: 'yo',
  offered: NEW_SCENES.map((n) => n.id),
  tv: { ip: '', name: 'Tele' },
  colors: [
    { hue: 28, sat: 100 },
    { hue: 345, sat: 85 },
    { hue: 200, sat: 80 },
    { hue: 270, sat: 70 },
  ],
});

type Api = {
  data: Data;
  flash: (msg: string) => void;
  setMe: (id: string) => void;
  setTv: (tv: NonNullable<Data['tv']>) => void;
  setHub: (host: string) => void;
  addPlace: (p: Omit<Place, 'id'>) => void;
  removePlace: (id: string) => void;
  setPlaces: (places: Place[]) => void;
  setMapKey: (key: string) => void;
  addPerson: () => void;
  renamePerson: (id: string, name: string) => void;
  removePerson: (id: string) => void;
  addColor: (c: SavedColor) => void;
  removeColor: (index: number) => void;
  upsertBulb: (b: Partial<Bulb> & { id?: string }) => void;
  removeBulb: (id: string) => void;
  upsertPlug: (p: Partial<Plug> & { id: string }) => void;
  /** Quita la toma y la saca de los modos que la tocaban */
  removePlug: (id: string) => void;
  upsertScene: (s: Omit<Scene, 'id'> & { id?: string }) => void;
  removeScene: (id: string) => void;
  /** Bombillas y enchufes de un devices.json (o de lo que manda el puente con «Traer del puente») */
  importDevices: (text: string, plugs?: Plug[]) => { added: number; updated: number; skipped: number };
  updateIps: (found: Found[]) => { updated: number; unknown: number };
};

/** Las bombillas que ofrece el puente de casa; sus claves se quedan allí. */
const withBridgeBulbs = (d: Data, list: BridgeBulb[]): Data => ({
  ...d,
  bulbs: [
    ...d.bulbs.filter((b) => list.some((x) => x.id === b.id)),
    ...list.filter((x) => !d.bulbs.some((b) => b.id === x.id)).map((x) => ({ id: x.id, name: x.name, room: '', ip: x.ip, key: 'puente' })),
  ],
});

/** Las tomas de enchufe que ofrece el puente; como con las bombillas, se quedan el nombre y el sitio de aquí. */
const withBridgePlugs = (d: Data, list: BridgePlug[]): Data => {
  const mine = d.plugs ?? [];
  return {
    ...d,
    plugs: [
      ...mine.filter((p) => list.some((x) => x.id === p.id)).map((p) => ({ ...p, ip: list.find((x) => x.id === p.id)!.ip })),
      ...list.filter((x) => !mine.some((p) => p.id === x.id)).map((x) => ({ ...x, room: '', key: 'puente' })),
    ],
  };
};

/** Escenas guardadas antes de que existiera el dibujo `icon`. */
/** El Lofi de serie llevaba un directo que YouTube ya no tiene: se le quita la tele. */
const withoutDeadVideo = (s: Scene): Scene =>
  s.tv?.youtube === 'jfKfPfyJRdk'
    ? { ...s, tv: undefined }
    : // la Chimenea de serie, con el Ambilight a juego (llegó después)
      s.id === 'chimenea' && s.tv && s.tv.ambilight === undefined
      ? { ...s, tv: { ...s.tv, ambilight: true } }
      : s;

// `saved` es lo guardado tal cual: lo ya ofrecido sale de ahí, nunca de los valores por defecto
const migrate = (d: Data, saved: Partial<Data>): Data => {
  const offered = saved.offered ?? [];
  const fresh = NEW_SCENES.filter((n) => !offered.includes(n.id) && !d.scenes.some((s) => s.id === n.id));
  return {
    ...d,
    tv: d.tv ?? { ip: '', name: 'Tele' },
    scenes: [...fresh, ...d.scenes.map((s) => (s.icon ? s : { ...s, icon: ICON_BY_ID[s.id] ?? 'bulb' })).map(withoutDeadVideo)],
    offered: [...new Set([...offered, ...NEW_SCENES.map((n) => n.id)])],
  };
};

const Ctx = createContext<Api>(null as unknown as Api);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);

  const key = useRef('');

  useEffect(() => {
    (async () => {
      const load = async () => {
        const raw = await AsyncStorage.getItem(storageKey()).catch(() => null);
        let d = initial();
        try {
          if (raw) {
            const saved = JSON.parse(raw) as Partial<Data>;
            d = migrate({ ...d, ...saved }, saved);
          }
        } catch {}
        return d;
      };
      // cómo llegamos a las bombillas; sin sockets propios, de eso depende dónde se guarda todo
      let d: Data;
      let bridged: { bulbs: BridgeBulb[]; plugs: BridgePlug[] } | null;
      if (HAS_TCP) {
        d = await load();
        bridged = await detectMode(d.hub);
      } else {
        bridged = await detectMode();
        d = await load();
      }
      key.current = storageKey();
      setData(bridged ? withBridgePlugs(withBridgeBulbs(d, bridged.bulbs), bridged.plugs) : d);
    })();
  }, []);

  useEffect(() => {
    if (data && key.current) AsyncStorage.setItem(key.current, JSON.stringify(data)).catch(() => {});
  }, [data]);

  const flash = useCallback((msg: string) => {
    toast.hideAll();
    toast.show({ label: msg, placement: 'top', duration: 2600 });
  }, []);

  const update = (fn: (d: Data) => Data) => setData((d) => (d ? fn(d) : d));

  if (!data) return null;

  const api: Api = {
    data,
    flash,
    setMe: (me) => update((d) => ({ ...d, me })),
    setTv: (tv) => update((d) => ({ ...d, tv })),
    setHub: (hub) => update((d) => ({ ...d, hub })),
    addPlace: (p) => update((d) => ({ ...d, places: [...(d.places ?? []), { ...p, id: uid() }] })),
    setPlaces: (places) => update((d) => ({ ...d, places })),
    setMapKey: (mapKey) => update((d) => (d.mapKey === mapKey ? d : { ...d, mapKey })),
    removePlace: (id) => update((d) => ({ ...d, places: (d.places ?? []).filter((p) => p.id !== id) })),
    upsertBulb: (b) =>
      update((d) => {
        const id = b.id ?? uid();
        const old = d.bulbs.find((x) => x.id === id);
        const merged: Bulb = { name: 'Bombilla', room: '', ip: '', key: '', ...old, ...b, id };
        return { ...d, bulbs: old ? d.bulbs.map((x) => (x.id === id ? merged : x)) : [...d.bulbs, merged] };
      }),
    removeBulb: (id) => update((d) => ({ ...d, bulbs: d.bulbs.filter((b) => b.id !== id) })),
    upsertPlug: (p) => update((d) => ({ ...d, plugs: (d.plugs ?? []).map((x) => (x.id === p.id ? { ...x, ...p } : x)) })),
    removePlug: (id) =>
      update((d) => ({
        ...d,
        plugs: (d.plugs ?? []).filter((p) => p.id !== id),
        scenes: d.scenes.map((s) => {
          if (!s.plugs || !(id in s.plugs)) return s;
          const { [id]: _gone, ...rest } = s.plugs;
          return { ...s, plugs: rest };
        }),
      })),
    addPerson: () => update((d) => ({ ...d, people: [...d.people, { id: uid(), name: `Persona ${d.people.length + 1}` }] })),
    renamePerson: (id, name) => update((d) => ({ ...d, people: d.people.map((p) => (p.id === id ? { ...p, name } : p)) })),
    // sus escenas pasan a ser de todos, para no perderlas
    removePerson: (id) =>
      update((d) => {
        const people = d.people.filter((p) => p.id !== id);
        return {
          ...d,
          people,
          me: d.me === id ? people[0]?.id ?? '' : d.me,
          scenes: d.scenes.map((s) => (s.owner === id ? { ...s, owner: '*' } : s)),
        };
      }),
    addColor: (c) =>
      update((d) =>
        d.colors.some((x) => Math.abs(x.hue - c.hue) < 4 && Math.abs(x.sat - c.sat) < 4) ? d : { ...d, colors: [...d.colors, c] },
      ),
    removeColor: (index) => update((d) => ({ ...d, colors: d.colors.filter((_, i) => i !== index) })),
    upsertScene: (s) =>
      update((d) => {
        const id = s.id ?? uid();
        const scene = { ...s, id } as Scene;
        const exists = d.scenes.some((x) => x.id === id);
        return { ...d, scenes: exists ? d.scenes.map((x) => (x.id === id ? scene : x)) : [...d.scenes, scene] };
      }),
    removeScene: (id) => update((d) => ({ ...d, scenes: d.scenes.filter((s) => s.id !== id) })),
    importDevices: (text, given) => {
      let list: any[];
      try {
        list = JSON.parse(text);
        if (!Array.isArray(list)) list = [list];
      } catch {
        return { added: 0, updated: 0, skipped: -1 };
      }
      let added = 0, updated = 0, skipped = 0;
      // los enchufes de devices.json, una toma por interruptor; los del puente ya vienen así
      const outlets = [...(given ?? []), ...list.filter((x: RawDevice) => x?.id && x?.key && isPlugDevice(x)).flatMap(outletsOf)];
      update((d) => {
        let bulbs = [...d.bulbs];
        let plugs = [...(d.plugs ?? [])];
        for (const o of outlets) {
          const i = plugs.findIndex((p) => p.id === o.id);
          if (i >= 0) {
            plugs[i] = { ...plugs[i], key: o.key, version: o.version, ip: o.ip || plugs[i].ip };
            updated++;
          } else {
            plugs.push({ ...o, room: '' });
            added++;
          }
        }
        if (outlets.length) plugs = plugs.filter((p) => !p.id.startsWith('demo-'));
        for (const x of list) {
          if (x?.id && x?.key && isPlugDevice(x)) continue;
          // sólo bombillas v2 (DPS 20); si el archivo no trae el mapa, se acepta
          if (!x?.id || !x?.key || !isBulbDevice(x)) {
            skipped++;
            continue;
          }
          const i = bulbs.findIndex((b) => b.id === x.id);
          const ip = x.ip && x.ip !== 'Auto' ? x.ip : '';
          if (i >= 0) {
            bulbs[i] = { ...bulbs[i], key: x.key, ip: ip || bulbs[i].ip };
            updated++;
          } else {
            bulbs.push({ id: x.id, name: x.name ?? 'Bombilla', room: '', ip, key: x.key });
            added++;
          }
        }
        // las de demostración sobran en cuanto hay bombillas reales
        if (bulbs.some((b) => !b.id.startsWith('demo-'))) bulbs = bulbs.filter((b) => !b.id.startsWith('demo-'));
        return { ...d, bulbs, plugs };
      });
      return { added, updated, skipped };
    },
    updateIps: (found) => {
      let updated = 0;
      const moved = <T extends { ip: string }>(x: T, gwId: string): T => {
        const f = found.find((y) => y.gwId === gwId);
        if (f && f.ip !== x.ip) {
          updated++;
          return { ...x, ip: f.ip };
        }
        return x;
      };
      update((d) => ({ ...d, bulbs: d.bulbs.map((b) => moved(b, b.id)), plugs: (d.plugs ?? []).map((p) => moved(p, p.devId)) }));
      const known = (id: string) => data.bulbs.some((b) => b.id === id) || (data.plugs ?? []).some((p) => p.devId === id);
      return { updated, unknown: found.filter((f) => !known(f.gwId)).length };
    },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
