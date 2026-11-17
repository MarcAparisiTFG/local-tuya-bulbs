// La casa vista desde el puente: cómo está cada bombilla (lo que ella cuenta) y los modos que manda la app.
// Poner y quitar un modo vive aquí para que HomeKit lo haga sin la app abierta; es lo mismo que applyScene y
// toggleScene de src/bulbs.tsx.
import { readFileSync, writeFileSync } from 'node:fs';
import { DEFAULT_LOOK, lookMatches, lookToDps, mergeDps, PARTY_MARK, partyScene, sceneLookFor } from '../src/lightCore';
import { byDevice, plugWatts } from '../src/plugs';
import { Dps } from '../src/tuya/device';
import { youtubeId } from '../src/tv/apps';
import { AmbilightConfig, presetFor } from '../src/tv/jointspace';
import { Look, Scene } from '../src/types';

export type BulbState = { look: Look; fx?: string; known: boolean };
export type HouseBulb = { id: string; name: string; room?: string };
/** Una toma de enchufe: `id` es `${devId}:${dp}` */
export type HousePlug = { id: string; devId: string; dp: string; name: string };
export type PlugState = { on: boolean; known: boolean };

type Io = {
  /** manda unos DPS a una bombilla o a un enchufe (lo definitivo, esperando respuesta) */
  setDps: (id: string, dps: Dps) => Promise<void>;
  tv: { openApp: (key: string) => Promise<void>; playYouTube: (id: string) => Promise<void> };
  ambilight: { get: () => Promise<AmbilightConfig | null>; set: (c: AmbilightConfig) => Promise<void>; preset: (p: ReturnType<typeof presetFor>) => Promise<void> } | null;
};

const MODES_FILE = new URL('../modes.json', import.meta.url);

export function createHouse(bulbs: HouseBulb[], plugs: HousePlug[], io: Io) {
  const state = new Map<string, BulbState>(bulbs.map((b) => [b.id, { look: DEFAULT_LOOK, known: false }]));
  const plugState = new Map<string, PlugState>(plugs.map((p) => [p.id, { on: false, known: false }]));
  // lo que gasta ahora cada enchufe entero (W), según él mismo
  const plugWattsNow = new Map<string, number>();
  const plugDevices = byDevice(plugs);
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((l) => l());

  let modes: Scene[] = [];
  try {
    modes = JSON.parse(readFileSync(MODES_FILE, 'utf8')).scenes ?? [];
  } catch {}
  // cómo estaban las luces y el Ambilight antes de cada modo, para dejarlas así al quitarlo
  const snapshots = new Map<string, Map<string, BulbState>>();
  const ambiSnapshots = new Map<string, AmbilightConfig | null>();
  const plugSnapshots = new Map<string, Map<string, boolean>>();

  const get = (id: string) => state.get(id) ?? { look: DEFAULT_LOOK, known: false };

  const getPlug = (id: string) => plugState.get(id) ?? { on: false, known: false };

  /** Lo que cuenta la bombilla o el enchufe (o lo que acabamos de mandarle). */
  function report(id: string, dps: Dps) {
    const outlets = plugDevices.get(id);
    if (outlets) {
      outlets.forEach((o) => {
        if (typeof dps[o.dp] === 'boolean') plugState.set(o.id, { on: dps[o.dp] === true, known: true });
      });
      const w = plugWatts(dps);
      if (w !== undefined) plugWattsNow.set(id, w);
      return changed();
    }
    const cur = get(id);
    let fx = cur.fx;
    if (dps['21'] !== undefined) fx = dps['21'] === 'scene' ? (typeof dps['25'] === 'string' ? dps['25'] : (cur.fx ?? 'scene')) : undefined;
    else if (typeof dps['25'] === 'string' && cur.fx) fx = dps['25'];
    state.set(id, { look: mergeDps(cur.look, dps), fx, known: true });
    changed();
  }

  const targets = (s: Scene) => bulbs.filter((b) => s.bulbIds === 'all' || s.bulbIds.includes(b.id));

  /** Las tomas que toca un modo (las que existen), con cómo las deja. */
  const plugTargets = (s: Scene) => plugs.filter((p) => s.plugs && p.id in s.plugs).map((p) => [p, s.plugs![p.id]] as const);

  /** Manda a cada enchufe un solo comando con todas sus tomas. */
  const sendPlugs = (list: (readonly [HousePlug, boolean])[]) =>
    [...byDevice(list.map(([p, on]) => ({ ...p, on }))).entries()].map(([devId, group]) => send(devId, Object.fromEntries(group.map((p) => [p.dp, p.on]))));

  function isActive(s: Scene): boolean {
    const t = targets(s);
    const pt = plugTargets(s);
    return (
      t.length + pt.length > 0 &&
      pt.every(([p, on]) => getPlug(p.id).known && getPlug(p.id).on === on) &&
      t.every((b) => {
        const l = get(b.id);
        if (!l.known) return false;
        if (s.kind === 'party') return l.look.on && !!l.fx?.startsWith(PARTY_MARK);
        const want = sceneLookFor(s, b.id);
        if (!want.on) return !l.look.on;
        return !l.fx && lookMatches(l.look, want);
      })
    );
  }

  async function send(id: string, dps: Dps) {
    report(id, dps);
    await io.setDps(id, dps);
  }

  async function apply(s: Scene) {
    const t = targets(s);
    if (s.tv?.app || s.tv?.youtube) {
      const video = s.tv.youtube ? youtubeId(s.tv.youtube) : null;
      (video ? io.tv.playYouTube(video) : io.tv.openApp(s.tv.app!)).catch((e) => console.log(`Tele: ${(e as Error).message}`));
    }
    if (s.tv?.ambilight && io.ambilight) {
      const ambi = io.ambilight;
      const look = t[0] ? sceneLookFor(s, t[0].id) : s.look;
      (async () => {
        if (!ambiSnapshots.has(s.id)) ambiSnapshots.set(s.id, await ambi.get());
        await ambi.preset(presetFor(look));
      })().catch((e) => console.log(`Ambilight: ${(e as Error).message}`));
    }
    const pt = plugTargets(s);
    if (!isActive(s)) {
      snapshots.set(s.id, new Map(t.filter((b) => get(b.id).known).map((b) => [b.id, get(b.id)])));
      plugSnapshots.set(s.id, new Map(pt.filter(([p]) => getPlug(p.id).known).map(([p]) => [p.id, getPlug(p.id).on])));
    }
    await Promise.allSettled([
      ...sendPlugs(pt),
      ...t.map((b) => (s.kind === 'party' ? send(b.id, { '20': true, '21': 'scene', '25': partyScene(s.speed ?? 3) }) : send(b.id, lookToDps(sceneLookFor(s, b.id))))),
    ]);
  }

  async function remove(s: Scene) {
    const snap = snapshots.get(s.id);
    snapshots.delete(s.id);
    const before = ambiSnapshots.get(s.id);
    ambiSnapshots.delete(s.id);
    if (s.tv?.ambilight && before && io.ambilight) io.ambilight.set(before).catch(() => {});
    const plugSnap = plugSnapshots.get(s.id);
    plugSnapshots.delete(s.id);
    await Promise.allSettled([
      // cada toma como estaba; sin recuerdo, al revés de como la deja el modo
      ...sendPlugs(plugTargets(s).map(([p, on]) => [p, plugSnap?.get(p.id) ?? !on] as const)),
      ...targets(s).map((b) => {
        const prev = snap?.get(b.id);
        if (prev?.fx) return send(b.id, { '20': prev.look.on, '21': 'scene', '25': prev.fx });
        // sin recuerdo: si el modo encendía, se apaga; si apagaba, se enciende
        return send(b.id, lookToDps(prev?.look ?? { ...get(b.id).look, on: !sceneLookFor(s, b.id).on }));
      }),
    ]);
  }

  return {
    bulbs,
    plugs,
    get,
    getPlug,
    /** Lo que gastan ahora los enchufes que lo miden (W) */
    plugWatts: () => [...plugWattsNow.values()].reduce((a, b) => a + b, 0),
    /** Enciende o apaga una toma */
    setPlug: (p: HousePlug, on: boolean) => send(p.devId, { [p.dp]: on }),
    report,
    send,
    modes: () => modes,
    setModes(list: Scene[]) {
      modes = list;
      writeFileSync(MODES_FILE, JSON.stringify({ scenes: list }, null, 2));
      changed();
    },
    isActive,
    apply,
    remove,
    onChange(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export type House = ReturnType<typeof createHouse>;
