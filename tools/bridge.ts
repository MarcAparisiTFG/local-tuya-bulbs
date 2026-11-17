// El puente de casa: es quien habla con las bombillas (aceptan una sola conexión a la vez) y todos le piden a él
// por HTTP: el navegador, Expo Go, la app compilada y HomeKit (tools/homekit.ts, para Siri). De momento corre
// en un ordenador de casa (un Mac, un Raspberry Pi…). Las claves se quedan aquí (../devices.json); por la red sólo viajan ids y estados.
//   npm run bridge          (sin HomeKit: NO_HOMEKIT=1 npm run bridge)
import { readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { randomInt } from 'node:crypto';
import os from 'node:os';
import tls from 'node:tls';
import { TlsConnect } from '../src/tv/cast';
import { createAmbilight } from '../src/tv/jointspace';
import { createTv } from '../src/tv/philips';
import { Connect, Dps, TuyaDevice } from '../src/tuya/device';
import { isBulbDevice, isPlugDevice, outletsOf, RawDevice, versionOf } from '../src/plugs';
import { Scene } from '../src/types';
import { dashboard, startEnergy } from './dashboard';
import { startHomeKit } from './homekit';
import { createHouse } from './house';
import { hasTraffic, mapKey, shapesFor, trafficPage, tripsNow, usedToday } from './traffic';
import type { Place } from '../src/types';

const PORT = Number(process.env.PORT ?? 8787);
// Para pasar las bombillas (con sus claves) a la app compilada, una vez: hay que escribir este código en ella.
// Cambia cada vez que arranca el puente y, tras 5 intentos fallidos, se desactiva hasta reiniciarlo.
const CODE = String(randomInt(0, 1_000_000)).padStart(6, '0');
let wrongCodes = 0;
type Dev = RawDevice & { id: string; name: string; ip: string; key: string };
const devices: Dev[] = JSON.parse(readFileSync(new URL('../devices.json', import.meta.url), 'utf8')).filter(
  (d: Dev) => d.id && d.key && d.ip,
);
// las bombillas por un lado; los enchufes, cada toma como aparato propio (comparten la conexión del enchufe)
const bulbs = devices.filter(isBulbDevice);
const outlets = devices.filter(isPlugDevice).flatMap(outletsOf);
const connect: Connect = (host, port, onConnect) => net.connect({ host, port }, onConnect) as unknown as ReturnType<Connect>;

// La tele Philips: IP de ../tv.json si existe (tools/python/tv_pair.py); su certificado es propio, se acepta sólo para ella
const tvCreds = (() => {
  try {
    return JSON.parse(readFileSync(new URL('../tv.json', import.meta.url), 'utf8')) as { ip: string; user: string; pass: string };
  } catch {
    return null;
  }
})();
const tvIp = tvCreds?.ip ?? process.env.TV_IP ?? '';
const tvTls: TlsConnect = (host, port, onConnect) => tls.connect({ host, port, rejectUnauthorized: false }, onConnect) as never;
const tv = createTv(tvIp, tvTls);
const ambilight = tvCreds ? createAmbilight(tvTls, tvCreds) : null;

const conns = new Map<string, Promise<TuyaDevice>>();

function device(id: string): Promise<TuyaDevice> {
  let p = conns.get(id);
  if (!p) {
    const d = devices.find((x) => x.id === id);
    if (!d) return Promise.reject(new Error('Esa bombilla no está en devices.json'));
    const dev = new TuyaDevice(d.id, d.ip, d.key, connect, versionOf(d.version));
    const mine = dev.connect().then(async () => {
      house.report(id, await dev.getStatus());
      return dev;
    });
    // Sólo se borra si sigue siendo la conexión actual: una vieja que se cierra tarde no debe tirar la nueva
    // (si no, se abre otra más y la anterior se queda abierta ocupando a la bombilla, que admite muy pocas)
    const forget = () => {
      if (conns.get(id) === mine) conns.delete(id);
    };
    dev.onClose = forget;
    // lo que cuenta la bombilla (también cuando la cambia otro) llega a HomeKit
    dev.onStatus = (dps) => house.report(id, dps);
    // conectó pero no contesta: se cierra, para no dejar el socket abierto
    mine.catch(() => {
      dev.close();
      forget();
    });
    conns.set(id, mine);
    p = mine;
  }
  return p;
}

async function withDevice<T>(id: string, fn: (d: TuyaDevice) => Promise<T>): Promise<T> {
  try {
    return await fn(await device(id));
  } catch {
    // una vez más con conexión nueva (suele ser un socket que se había cerrado); la vieja se cierra
    const old = conns.get(id);
    conns.delete(id);
    old?.then((d) => d.close()).catch(() => {});
    return fn(await device(id));
  }
}

// Lo que llega mientras se arrastra: se contesta al momento y, por bombilla, sólo vale el último.
// Un envío a la vez; cuando la bombilla contesta, se manda el más reciente que haya llegado entretanto.
const latest = new Map<string, object>();
const busy = new Set<string>();

function live(id: string, dps: object) {
  house.report(id, dps as Dps);
  latest.set(id, dps);
  if (busy.has(id)) return;
  busy.add(id);
  (async () => {
    for (let next = latest.get(id); next; next = latest.get(id)) {
      latest.delete(id);
      await withDevice(id, (d) => d.setDps(next as Record<string, string | number | boolean>)).catch(() => {});
    }
    busy.delete(id);
  })();
}

const house = createHouse(
  bulbs.map(({ id, name }) => ({ id, name })),
  outlets.map(({ id, devId, dp, name }) => ({ id, devId, dp, name })),
  {
    setDps: (id, dps) => {
      // lo definitivo pisa cualquier cambio en vivo que quedara por mandar
      latest.delete(id);
      return withDevice(id, (d) => d.setDps(dps));
    },
    tv,
    ambilight,
  },
);

const energy = startEnergy(house);

const PLACES = new URL('../places.json', import.meta.url);
const places = (): Place[] => {
  try {
    return JSON.parse(readFileSync(PLACES, 'utf8')).places ?? [];
  } catch {
    return [];
  }
};

const readBody = (req: http.IncomingMessage) =>
  new Promise<string>((resolve) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s));
  });

http
  .createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.end();
    const reply = (code: number, body: unknown) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    try {
      const [, route, rawId] = (req.url ?? '').split('?')[0].split('/');
      const id = decodeURIComponent(rawId ?? '');
      // sólo bombillas: las apps de antes de los enchufes tratan todo lo de aquí como una bombilla
      if (route === 'bulbs') return reply(200, bulbs.map(({ id, name, ip }) => ({ id, name, ip })));
      if (route === 'plugs') return reply(200, outlets.map(({ id, devId, dp, name, ip, version }) => ({ id, devId, dp, name, ip, version })));
      if (route === 'tv' && (req.url ?? '').startsWith('/tv/now')) return reply(200, { now: await tv.nowPlaying() });
      if (route === 'tv' && (req.url ?? '').startsWith('/tv/ambilight')) {
        if (!ambilight) return reply(409, { error: 'Falta emparejar la tele (tools/tv_pair.py)' });
        if (req.method === 'GET') return reply(200, { config: await ambilight.get() });
        const cfg = JSON.parse(await readBody(req));
        await ('preset' in cfg ? ambilight.preset(cfg.preset) : ambilight.set(cfg));
        return reply(200, { ok: true });
      }
      if (route === 'tv' && req.method === 'POST') {
        const [, , what, arg] = (req.url ?? '').split('?')[0].split('/');
        const value = decodeURIComponent(arg ?? '');
        if (what === 'app') await tv.openApp(value);
        else if (what === 'youtube') await tv.playYouTube(value);
        else return reply(404, { error: 'No existe' });
        return reply(200, { ok: true });
      }
      if (route === 'export') {
        const code = new URL(req.url ?? '', 'http://x').searchParams.get('code');
        if (wrongCodes >= 5) return reply(403, { error: 'Demasiados intentos: reinicia el puente' });
        if (code !== CODE) {
          wrongCodes++;
          return reply(403, { error: 'Código incorrecto' });
        }
        console.log('Bombillas enviadas a la app');
        return reply(200, { bulbs: bulbs.map(({ id, name, ip, key }) => ({ id, name, ip, key })), plugs: outlets, tv: tvCreds });
      }
      if (route === 'status' && id) {
        const dps = await withDevice(id, (d) => d.getStatus());
        house.report(id, dps);
        return reply(200, dps);
      }
      // los modos de la app, para que HomeKit tenga los mismos
      if (route === 'modes') {
        if (req.method === 'POST') house.setModes(JSON.parse(await readBody(req)).scenes as Scene[]);
        return reply(200, { scenes: house.modes(), active: house.modes().filter(house.isActive).map((s) => s.id) });
      }
      // los sitios (pestaña Sitios y widget): los guarda el puente para que todos los aparatos tengan los mismos
      if (route === 'places') {
        if (req.method === 'POST') writeFileSync(PLACES, JSON.stringify(JSON.parse(await readBody(req)), null, 2));
        return reply(200, { places: places() });
      }
      // el resumen del inicio: tiempo, sol, mar, avisos, gasolina, luz y lo que gastan las luces
      if (route === 'dashboard') return reply(200, await dashboard(energy));
      // cuánto se tarda ahora a cada sitio, con tráfico si hay clave de TomTom
      if (route === 'trips') {
        const fresh = new URL(req.url ?? '', 'http://x').searchParams.has('fresh');
        const [trips, shapes] = await Promise.all([tripsNow(places(), fresh), shapesFor(places())]);
        return reply(200, { trips, shapes, mapKey: mapKey(), traffic: hasTraffic(), usedToday: usedToday() });
      }
      if (route === 'traffic') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(await trafficPage(places()));
      }
      // poner o quitar un modo desde fuera de la app (el widget de la tablet)
      if (route === 'mode' && id && req.method === 'POST') {
        const scene = house.modes().find((s) => s.id === id);
        if (!scene) return reply(404, { error: 'Ese modo no existe' });
        const on = house.isActive(scene);
        await (on ? house.remove(scene) : house.apply(scene));
        return reply(200, { active: !on });
      }
      if (route === 'live' && id && req.method === 'POST') {
        live(id, JSON.parse(await readBody(req)));
        return reply(200, { ok: true });
      }
      if (route === 'dps' && id && req.method === 'POST') {
        await house.send(id, JSON.parse(await readBody(req)));
        return reply(200, { ok: true });
      }
      reply(404, { error: 'No existe' });
    } catch (e) {
      reply(502, { error: (e as Error).message });
    }
  })
  .listen(PORT, '0.0.0.0', () => {
    const ips = Object.values(os.networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => i!.address);
    console.log(`Puente de MarsianApp en el puerto ${PORT} · ${bulbs.length} bombilla(s): ${bulbs.map((d) => d.name).join(', ')}`);
    if (outlets.length) console.log(`Enchufes: ${outlets.map((o) => o.name).join(', ')}`);
    console.log(`En esta red: ${ips.map((ip) => `http://${ip}:${PORT}`).join('  ')}`);
    console.log(`Para la app compilada (Ajustes → Traer del puente): IP ${ips[0] ?? '?'} · código ${CODE}`);
    // cada bombilla conectada desde el principio, y repasadas de vez en cuando por si alguna se ha perdido
    const refresh = () => devices.forEach((d) => withDevice(d.id, async () => undefined).catch(() => {}));
    refresh();
    setInterval(refresh, 30_000);
    if (!process.env.NO_HOMEKIT) startHomeKit(house);
  });
