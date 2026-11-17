import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_LOOK, lookFromDps, lookMatches, mergeDps, PARTY_MARK, partyScene, sceneLookFor } from './look';
import { Dps } from './tuya/device';
import { youtubeId } from './tv/apps';
import { tvClient } from './tv/client';
import { AmbilightConfig, presetFor } from './tv/jointspace';
import { useApp } from './state';
import { byDevice, plugTarget, plugWatts } from './plugs';
import { applyLive, applyLook, closeAll, getStatus, setDps, watch } from './tuya/pool';
import { Bulb, Look, Plug, Scene } from './types';

// Mientras se arrastra: separación mínima entre comandos. Además nunca hay dos en camino a la vez:
// si llega uno nuevo mientras otro viaja, sustituye al que esperaba (siempre gana el último).
const LIVE_MS = 50;
// Tras tocar algo, se ignoran un momento los avisos de la bombilla (llegan con retraso y moverían el control)
const QUIET_MS = 1200;

export type BulbLive = {
  look: Look;
  state: 'loading' | 'ok' | 'error';
  error: string;
  /** Si la bombilla está reproduciendo una escena nativa (DPS 21 = scene), su DPS 25 */
  fx?: string;
  /** Enchufes: lo que gasta ahora el enchufe entero, en W (se guarda bajo el id del enchufe, no de cada toma) */
  watts?: number;
};
const LOADING: BulbLive = { look: DEFAULT_LOOK, state: 'loading', error: '' };

type Api = {
  live: (id: string) => BulbLive;
  /** Cambia el aspecto en pantalla al momento y lo manda a la bombilla (con `commit` sin esperar). */
  change: (b: Bulb, look: Look, commit: boolean) => void;
  retry: (id: string) => void;
  setPower: (bulbs: Bulb[], on: boolean) => Promise<void>;
  /** Enciende o apaga tomas de enchufe (su estado vive bajo el id de cada toma, en `look.on`) */
  setPlugs: (plugs: Plug[], on: boolean) => Promise<void>;
  /** Pone un modo (y recuerda cómo estaban sus bombillas, para poder quitarlo) */
  applyScene: (s: Scene) => Promise<void>;
  /** Si el modo está puesto, lo quita dejando las luces como estaban; si no, lo pone */
  toggleScene: (s: Scene) => Promise<void>;
};

/** Las bombillas de un modo. */
export const sceneTargets = (s: Scene, bulbs: Bulb[]) => (s.bulbIds === 'all' ? bulbs : bulbs.filter((b) => (s.bulbIds as string[]).includes(b.id)));

/** Las tomas de enchufe que toca un modo, con cómo las deja. */
export const scenePlugs = (s: Scene) => Object.entries(s.plugs ?? {});

/** ¿Está puesto ahora mismo? Se mira la luz real de cada bombilla, no cuál se tocó la última vez. */
export function sceneActive(s: Scene, bulbs: Bulb[], get: (id: string) => BulbLive): boolean {
  const targets = sceneTargets(s, bulbs);
  const plugs = scenePlugs(s);
  return (
    targets.length + plugs.length > 0 &&
    plugs.every(([id, on]) => get(id).state === 'ok' && get(id).look.on === on) &&
    targets.every((b) => {
      const l = get(b.id);
      if (l.state !== 'ok') return false;
      if (s.kind === 'party') return l.look.on && !!l.fx?.startsWith(PARTY_MARK);
      const want = sceneLookFor(s, b.id);
      if (!want.on) return !l.look.on;
      return !l.fx && lookMatches(l.look, want);
    })
  );
}

/** El DPS 25 de una escena nativa, si la bombilla está en ese modo; lo demás, sin cambios. */
function fxFrom(d: Dps, cur?: string): string | undefined {
  if (d['21'] !== undefined) return d['21'] === 'scene' ? (typeof d['25'] === 'string' ? d['25'] : (cur ?? 'scene')) : undefined;
  if (typeof d['25'] === 'string' && cur) return d['25'];
  return cur;
}

type Snapshot = Map<string, { look: Look; fx?: string }>;

/**
 * El estado vivo de las bombillas va fuera de React: al arrastrar cambia decenas de veces por segundo y,
 * dentro de un contexto, cada cambio redibujaría toda la app. Así sólo se redibuja quien mira esa bombilla.
 */
class LiveStore {
  private map = new Map<string, BulbLive>();
  private listeners = new Set<() => void>();
  get = (id: string) => this.map.get(id) ?? LOADING;
  patch(id: string, p: Partial<BulbLive> | ((cur: BulbLive) => Partial<BulbLive>)) {
    const cur = this.get(id);
    this.map.set(id, { ...cur, ...(typeof p === 'function' ? p(cur) : p) });
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
}

const Ctx = createContext<{ store: LiveStore; api: Api }>(null as unknown as { store: LiveStore; api: Api });
/** Las acciones; no cambian, así que usarlas no redibuja nada. */
export const useBulbs = () => useContext(Ctx).api;
/** El estado de una bombilla; redibuja sólo cuando cambia esa. */
export function useBulb(id: string) {
  const { store } = useContext(Ctx);
  return useSyncExternalStore(store.subscribe, () => store.get(id));
}
/** Ids de las escenas cuyas bombillas están ahora mismo exactamente como ellas dicen. */
export function useActiveScenes(scenes: Scene[], bulbs: Bulb[]): Set<string> {
  const ids = useLiveSelect((get) =>
    scenes
      .filter((s) => {
        return sceneActive(s, bulbs, get);
      })
      .map((s) => s.id)
      .join(','),
  );
  return useMemo(() => new Set(ids ? ids.split(',') : []), [ids]);
}

/** Un dato derivado de todas (cuántas encendidas…); redibuja sólo cuando cambia el resultado. */
export function useLiveSelect<T extends string | number | boolean>(select: (get: (id: string) => BulbLive) => T) {
  const { store } = useContext(Ctx);
  return useSyncExternalStore(store.subscribe, () => select(store.get));
}

/** Un único estado por bombilla para toda la app: la tarjeta del inicio y el detalle enseñan lo mismo. */
export function BulbsProvider({ children }: { children: ReactNode }) {
  const { data, flash } = useApp();
  const store = useRef(new LiveStore()).current;
  const [gen, setGen] = useState(0);
  // las acciones son estables; leen los datos y avisos del momento por aquí
  const latest = useRef({ data, flash });
  latest.current = { data, flash };
  const touched = useRef(new Map<string, number>());
  const sent = useRef(new Map<string, number>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const inflight = useRef(new Set<string>());
  const pendingLive = useRef(new Map<string, { b: Bulb; look: Look }>());
  const offs = useRef(new Map<string, () => void>());
  // cómo estaban las bombillas antes de cada modo, para dejarlas igual al quitarlo
  const snapshots = useRef(new Map<string, Snapshot>());
  const ambiSnapshots = useRef(new Map<string, AmbilightConfig | null>());

  const patch = useCallback((id: string, p: Partial<BulbLive> | ((cur: BulbLive) => Partial<BulbLive>)) => store.patch(id, p), [store]);

  const connect = useCallback(
    async (b: Bulb, alive: () => boolean) => {
      offs.current.get(b.id)?.();
      offs.current.delete(b.id);
      if (!b.ip || !b.key) {
        patch(b.id, { state: 'error', error: !b.key ? 'Falta la clave local' : 'Falta la IP' });
        return;
      }
      patch(b.id, { state: 'loading', error: '' });
      try {
        const dps = await getStatus(b);
        if (!alive()) return;
        patch(b.id, { look: lookFromDps(dps), fx: fxFrom(dps), state: 'ok', error: '' });
        const off = await watch(b, (d) => {
          if (Date.now() - (touched.current.get(b.id) ?? 0) > QUIET_MS) patch(b.id, (cur) => ({ look: mergeDps(cur.look, d), fx: fxFrom(d, cur.fx) }));
        });
        if (!alive()) return off();
        offs.current.set(b.id, off);
      } catch (e) {
        if (alive()) patch(b.id, { state: 'error', error: (e as Error).message });
      }
    },
    [patch],
  );

  /** Un enchufe y sus tomas: una sola conexión; cada toma lleva su estado y el enchufe, lo que gasta. */
  const connectPlug = useCallback(
    async (outlets: Plug[], alive: () => boolean) => {
      const first = outlets[0];
      const devId = first.devId;
      offs.current.get(devId)?.();
      offs.current.delete(devId);
      const each = (p: Partial<BulbLive>) => outlets.forEach((o) => patch(o.id, p));
      if (!first.ip || !first.key) return each({ state: 'error', error: !first.key ? 'Falta la clave local' : 'Falta la IP' });
      each({ state: 'loading', error: '' });
      const take = (d: Dps, all: boolean) => {
        outlets.forEach((o) => {
          if (typeof d[o.dp] !== 'boolean') return all ? patch(o.id, { state: 'ok', error: '' }) : undefined;
          if (!all && Date.now() - (touched.current.get(o.id) ?? 0) < QUIET_MS) return;
          patch(o.id, { look: { ...DEFAULT_LOOK, on: d[o.dp] === true }, state: 'ok', error: '' });
        });
        const w = plugWatts(d);
        if (w !== undefined) patch(devId, { watts: w, state: 'ok' });
      };
      try {
        const target = plugTarget(first);
        const dps = await getStatus(target);
        if (!alive()) return;
        take(dps, true);
        const off = await watch(target, (d) => take(d, false));
        if (!alive()) return off();
        offs.current.set(devId, off);
      } catch (e) {
        if (alive()) each({ state: 'error', error: (e as Error).message });
      }
    },
    [patch],
  );

  const plugs = data.plugs ?? [];
  const signature = [...data.bulbs, ...plugs].map((b) => `${b.id}|${b.ip}|${b.key}`).join(',');
  useEffect(() => {
    let alive = true;
    data.bulbs.forEach((b) => connect(b, () => alive));
    byDevice(plugs).forEach((outlets) => connectPlug(outlets, () => alive));
    return () => {
      alive = false;
      offs.current.forEach((off) => off());
      offs.current.clear();
    };
  }, [signature, gen]);

  // La bombilla admite pocas conexiones: se sueltan al irse a segundo plano y se recuperan al volver
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setGen((g) => g + 1);
      else closeAll();
    });
    return () => sub.remove();
  }, []);

  // Lo que se manda mientras se arrastra: uno en camino como mucho; el siguiente espera y, si llega otro, lo sustituye
  const pushLive = (b: Bulb, look: Look) => {
    if (inflight.current.has(b.id)) {
      pendingLive.current.set(b.id, { b, look });
      return;
    }
    inflight.current.add(b.id);
    sent.current.set(b.id, Date.now());
    applyLive(b, look)
      .catch(() => {})
      .finally(() => {
        inflight.current.delete(b.id);
        const next = pendingLive.current.get(b.id);
        if (next) {
          pendingLive.current.delete(b.id);
          pushLive(next.b, next.look);
        }
      });
  };

  const send = (b: Bulb, look: Look, live: boolean) => {
    if (live) return pushLive(b, look);
    // al soltar: lo que quedara por mandar en vivo ya no hace falta
    pendingLive.current.delete(b.id);
    sent.current.set(b.id, Date.now());
    applyLook(b, look).catch((e: Error) => {
      latest.current.flash(`${b.name}: ${e.message}`);
      // por si sólo ha sido un comando perdido: se vuelve a leer la bombilla antes de darla por caída
      getStatus(b)
        .then((d) => patch(b.id, { look: lookFromDps(d), state: 'ok' }))
        .catch((e2: Error) => patch(b.id, { state: 'error', error: e2.message }));
    });
  };

  /** Las tomas de un modo que existen, con cómo las deja. */
  const plugsOf = (s: Scene): [Plug, boolean][] =>
    scenePlugs(s).flatMap(([id, on]) => {
      const p = latest.current.data.plugs?.find((x) => x.id === id);
      return p ? [[p, on] as [Plug, boolean]] : [];
    });

  /** Manda a cada enchufe un solo comando con todas sus tomas; cuenta cuántas tomas no han respondido. */
  const sendPlugs = async (list: [Plug, boolean][]) => {
    let failed = 0;
    let error = '';
    await Promise.all(
      [...byDevice(list.map(([p, on]) => ({ p, on, devId: p.devId }))).values()].map((group) =>
        setDps(plugTarget(group[0].p), Object.fromEntries(group.map(({ p, on }) => [p.dp, on]))).catch((e: Error) => {
          failed += group.length;
          error = e.message;
          group.forEach(({ p }) => patch(p.id, { state: 'error', error: e.message }));
        }),
      ),
    );
    return { failed, error };
  };

  const api: Api = useMemo<Api>(
    () => ({
      live: store.get,
      change: (b, look, commit) => {
        // tocar la luz a mano saca a la bombilla de cualquier fiesta
        patch(b.id, { look, fx: undefined });
        touched.current.set(b.id, Date.now());
        clearTimeout(timers.current.get(b.id));
        const wait = commit ? 0 : Math.max(0, LIVE_MS - (Date.now() - (sent.current.get(b.id) ?? 0)));
        timers.current.set(b.id, setTimeout(() => send(b, look, !commit), wait));
      },
      retry: (id) => {
        const b = latest.current.data.bulbs.find((x) => x.id === id);
        if (b) return connect(b, () => true);
        const p = latest.current.data.plugs?.find((x) => x.id === id);
        if (p) connectPlug(latest.current.data.plugs!.filter((x) => x.devId === p.devId), () => true);
      },
      setPower: async (bulbs, on) => {
        bulbs.forEach((b) => {
          touched.current.set(b.id, Date.now());
          patch(b.id, (cur) => ({ look: { ...cur.look, on } }));
        });
        const res = await Promise.allSettled(bulbs.map((b) => setDps(b, { '20': on })));
        const failed = res.filter((r) => r.status === 'rejected').length;
        if (failed) latest.current.flash(`${failed} de ${bulbs.length} no responden`);
      },
      setPlugs: async (list, on) => {
        list.forEach((p) => {
          touched.current.set(p.id, Date.now());
          patch(p.id, (cur) => ({ look: { ...cur.look, on } }));
        });
        const res = await sendPlugs(list.map((p) => [p, on]));
        if (res.failed) latest.current.flash(list.length === 1 ? `${list[0].name}: ${res.error}` : `${res.failed} enchufe(s) no responden`);
      },
      applyScene: async (s) => {
        const { data, flash } = latest.current;
        const targets = sceneTargets(s, data.bulbs);
        // la tele va a la vez que las luces y por su cuenta (YouTube tarda unos segundos en arrancar)
        const tv = tvClient(data.tv);
        if (s.tv?.app || s.tv?.youtube) {
          const video = s.tv.youtube ? youtubeId(s.tv.youtube) : null;
          (video ? tv.playYouTube(video) : tv.openApp(s.tv.app!)).catch((e: Error) => latest.current.flash(`Tele: ${e.message}`));
        }
        if (s.tv?.ambilight) {
          const first = targets[0];
          const look = first ? sceneLookFor(s, first.id) : s.look;
          (async () => {
            // cómo estaba, para devolverlo así al quitar el modo (salvo que ya fuera este modo)
            if (!ambiSnapshots.current.has(s.id)) ambiSnapshots.current.set(s.id, await tv.ambilight());
            await tv.setAmbilight({ preset: presetFor(look) });
          })().catch((e: Error) => latest.current.flash(`Ambilight: ${e.message}`));
        }
        const plugSet = plugsOf(s);
        if (!targets.length && !plugSet.length) return flash('Este modo no tiene bombillas ni enchufes');
        // lo de antes, salvo que ya fuera este mismo modo (si no, «quitarlo» lo volvería a dejar puesto)
        if (!sceneActive(s, data.bulbs, store.get)) {
          const snap: Snapshot = new Map();
          targets.forEach((b) => {
            const l = store.get(b.id);
            if (l.state === 'ok') snap.set(b.id, { look: l.look, fx: l.fx });
          });
          plugSet.forEach(([p]) => {
            const l = store.get(p.id);
            if (l.state === 'ok') snap.set(p.id, { look: l.look });
          });
          snapshots.current.set(s.id, snap);
        }
        plugSet.forEach(([p, on]) => {
          touched.current.set(p.id, Date.now());
          patch(p.id, (cur) => ({ look: { ...cur.look, on } }));
        });
        const plugsSent = sendPlugs(plugSet);
        const res = await Promise.allSettled(
          targets.map((b) => {
            touched.current.set(b.id, Date.now());
            if (s.kind === 'party') {
              // cada bombilla su propia fiesta: así no van todas iguales
              const fx = partyScene(s.speed ?? 3);
              patch(b.id, (cur) => ({ look: { ...cur.look, on: true }, fx }));
              return setDps(b, { '20': true, '21': 'scene', '25': fx });
            }
            const look = sceneLookFor(s, b.id);
            patch(b.id, (cur) => ({ look: look.on ? look : { ...cur.look, on: false }, fx: look.on ? undefined : cur.fx }));
            return applyLook(b, look);
          }),
        );
        const failed = res.filter((r) => r.status === 'rejected').length + (await plugsSent).failed;
        flash(failed ? `${s.name}: ${failed} de ${targets.length + plugSet.length} no responden` : s.name);
      },
      toggleScene: async (s) => {
        const { data, flash } = latest.current;
        if (!sceneActive(s, data.bulbs, store.get)) return api.applyScene(s);
        const snap = snapshots.current.get(s.id);
        snapshots.current.delete(s.id);
        if (s.tv?.ambilight && ambiSnapshots.current.get(s.id)) {
          const before = ambiSnapshots.current.get(s.id)!;
          tvClient(data.tv)
            .setAmbilight(before)
            .catch((e: Error) => latest.current.flash(`Ambilight: ${e.message}`));
        }
        ambiSnapshots.current.delete(s.id);
        const targets = sceneTargets(s, data.bulbs);
        // cada toma, como estaba; sin recuerdo, al revés de como la deja el modo
        const plugSet = plugsOf(s).map(([p, on]): [Plug, boolean] => [p, snap?.get(p.id)?.look.on ?? !on]);
        plugSet.forEach(([p, on]) => {
          touched.current.set(p.id, Date.now());
          patch(p.id, (cur) => ({ look: { ...cur.look, on } }));
        });
        const plugsSent = sendPlugs(plugSet);
        const res = await Promise.allSettled(
          targets.map((b) => {
            touched.current.set(b.id, Date.now());
            const prev = snap?.get(b.id);
            if (prev?.fx) {
              patch(b.id, { look: prev.look, fx: prev.fx });
              return setDps(b, { '20': prev.look.on, '21': 'scene', '25': prev.fx });
            }
            // sin recuerdo (p. ej. tras reabrir la app): si el modo encendía, se apaga; si apagaba, se enciende
            const look = prev?.look ?? { ...store.get(b.id).look, on: !sceneLookFor(s, b.id).on };
            patch(b.id, { look, fx: undefined });
            return applyLook(b, look);
          }),
        );
        const failed = res.filter((r) => r.status === 'rejected').length + (await plugsSent).failed;
        flash(failed ? `${s.name}: ${failed} de ${targets.length + plugSet.length} no responden` : `${s.name}, quitado`);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const value = useMemo(() => ({ store, api }), [store, api]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
