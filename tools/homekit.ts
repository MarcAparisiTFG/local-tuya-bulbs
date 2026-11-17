// La casa en la app Casa de Apple (HomeKit): cada bombilla es una luz y cada modo un interruptor «Modo X».
// Así Siri los entiende sin nombrar ninguna app: «Oye Siri, enciende modo Chimenea», «apaga las luces del
// comedor». Funciona en el Wi-Fi de casa sin HomePod. El emparejamiento se guarda fuera del repo
// (../homekit.json y ../homekit-data), como las claves de las bombillas.
import { randomBytes, randomInt } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Accessory, Bridge, Categories, Characteristic, HAPStorage, Service, uuid } from 'hap-nodejs';
import qrcode from 'qrcode-terminal';
import { lookToDps } from '../src/lightCore';
import { Look, Scene } from '../src/types';
import { House, HousePlug } from './house';

const PAIRING = new URL('../homekit.json', import.meta.url);
const STORAGE = fileURLToPath(new URL('../homekit-data', import.meta.url));

type Pairing = { username: string; pincode: string; setupID: string };

/** El código para añadir el puente en la app Casa: se crea una vez y se queda. */
function pairing(): Pairing {
  try {
    return JSON.parse(readFileSync(PAIRING, 'utf8'));
  } catch {
    const d = () => String(randomInt(0, 10));
    const p: Pairing = {
      username: Array.from(randomBytes(6), (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':'),
      // HomeKit no acepta códigos demasiado simples (111-11-111, 123-45-678…); uno al azar nunca lo es
      pincode: `${d()}${d()}${d()}-${d()}${d()}-${d()}${d()}${d()}`,
      setupID: Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(0, 32)]).join(''),
    };
    writeFileSync(PAIRING, JSON.stringify(p, null, 2));
    return p;
  }
}

// temperatura del blanco: la app usa 0 (cálida) a 100 (fría); HomeKit, mireds de 500 (cálida) a 140 (fría)
const toMired = (t: number) => Math.round(500 - t * 3.6);
const fromMired = (m: number) => Math.min(100, Math.max(0, (500 - m) / 3.6));

function bulbAccessory(house: House, id: string, name: string) {
  const acc = new Accessory(name, uuid.generate(`marsianapp.bulb.${id}`));
  acc.getService(Service.AccessoryInformation)!.setCharacteristic(Characteristic.Manufacturer, 'Muvit').setCharacteristic(Characteristic.Model, 'MarsianApp');
  const s = acc.addService(Service.Lightbulb, name);
  const look = () => house.get(id).look;

  // HomeKit manda tono y saturación por separado y casi a la vez: se juntan un instante y va un solo envío
  let pending: Look | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const change = (fn: (l: Look) => Look) => {
    pending = fn(pending ?? look());
    clearTimeout(timer);
    timer = setTimeout(() => {
      const l = pending!;
      pending = null;
      house.send(id, lookToDps(l)).catch((e) => console.log(`HomeKit → ${name}: ${(e as Error).message}`));
    }, 60);
  };

  s.getCharacteristic(Characteristic.On)
    .onGet(() => look().on)
    .onSet((v) => change((l) => ({ ...l, on: !!v })));
  s.getCharacteristic(Characteristic.Brightness)
    .onGet(() => Math.round(look().brightness))
    .onSet((v) => change((l) => ({ ...l, on: Number(v) > 0, brightness: Math.max(1, Number(v)) })));
  s.getCharacteristic(Characteristic.Hue)
    .onGet(() => Math.round(look().hue))
    .onSet((v) => change((l) => ({ ...l, on: true, mode: 'colour', hue: Number(v) })));
  s.getCharacteristic(Characteristic.Saturation)
    .onGet(() => Math.round(look().sat))
    .onSet((v) => change((l) => ({ ...l, on: true, mode: 'colour', sat: Number(v) })));
  s.getCharacteristic(Characteristic.ColorTemperature)
    .setProps({ minValue: 140, maxValue: 500 })
    .onGet(() => toMired(look().temp))
    .onSet((v) => change((l) => ({ ...l, on: true, mode: 'white', temp: fromMired(Number(v)) })));

  const refresh = () => {
    if (pending) return;
    const l = look();
    s.updateCharacteristic(Characteristic.On, l.on);
    s.updateCharacteristic(Characteristic.Brightness, Math.round(l.brightness));
    s.updateCharacteristic(Characteristic.Hue, Math.round(l.hue));
    s.updateCharacteristic(Characteristic.Saturation, Math.round(l.sat));
    s.updateCharacteristic(Characteristic.ColorTemperature, toMired(l.temp));
  };
  return { acc, refresh };
}

/** Una toma de enchufe: en la app Casa, un enchufe que se enciende y apaga («Oye Siri, apaga el enchufe 2»). */
function plugAccessory(house: House, p: HousePlug) {
  const acc = new Accessory(p.name, uuid.generate(`marsianapp.plug.${p.id}`));
  acc.getService(Service.AccessoryInformation)!.setCharacteristic(Characteristic.Manufacturer, 'Muvit').setCharacteristic(Characteristic.Model, 'MarsianApp');
  const s = acc.addService(Service.Outlet, p.name);
  s.getCharacteristic(Characteristic.On)
    .onGet(() => house.getPlug(p.id).on)
    .onSet((v) => house.setPlug(p, !!v).catch((e) => console.log(`HomeKit → ${p.name}: ${(e as Error).message}`)));
  // si algo enchufado gasta: el enchufe lo mide entero, así que vale para cualquiera de sus tomas encendidas
  s.getCharacteristic(Characteristic.OutletInUse).onGet(() => house.getPlug(p.id).on);
  return {
    acc,
    refresh: () => {
      s.updateCharacteristic(Characteristic.On, house.getPlug(p.id).on);
      s.updateCharacteristic(Characteristic.OutletInUse, house.getPlug(p.id).on);
    },
  };
}

function modeAccessory(house: House, scene: Scene) {
  const name = `Modo ${scene.name}`;
  const acc = new Accessory(name, uuid.generate(`marsianapp.mode.${scene.id}`));
  acc.getService(Service.AccessoryInformation)!.setCharacteristic(Characteristic.Manufacturer, 'MarsianApp').setCharacteristic(Characteristic.Model, 'Modo');
  const s = acc.addService(Service.Switch, name);
  const current = () => house.modes().find((m) => m.id === scene.id) ?? scene;
  s.getCharacteristic(Characteristic.On)
    .onGet(() => house.isActive(current()))
    .onSet(async (v) => {
      const m = current();
      if (v && !house.isActive(m)) await house.apply(m);
      else if (!v && house.isActive(m)) await house.remove(m);
    });
  return { acc, refresh: () => s.updateCharacteristic(Characteristic.On, house.isActive(current())) };
}

export function startHomeKit(house: House) {
  mkdirSync(STORAGE, { recursive: true });
  HAPStorage.setCustomStoragePath(STORAGE);
  const p = pairing();
  const bridge = new Bridge('Casa Marsiana', uuid.generate('marsianapp.bridge'));

  const lights = house.bulbs.map((b) => bulbAccessory(house, b.id, b.name));
  lights.forEach((l) => bridge.addBridgedAccessory(l.acc));
  const outlets = house.plugs.map((p) => plugAccessory(house, p));
  outlets.forEach((o) => bridge.addBridgedAccessory(o.acc));

  // un interruptor por modo; cuando la app manda otra lista, se añaden, quitan o renombran
  const modes = new Map<string, { name: string; acc: Accessory; refresh: () => void }>();
  const syncModes = () => {
    const list = house.modes();
    for (const [id, m] of modes) {
      const now = list.find((s) => s.id === id);
      if (!now || now.name !== m.name) {
        bridge.removeBridgedAccessory(m.acc);
        modes.delete(id);
      }
    }
    for (const s of list) {
      if (modes.has(s.id)) continue;
      const m = modeAccessory(house, s);
      bridge.addBridgedAccessory(m.acc);
      modes.set(s.id, { name: s.name, ...m });
    }
  };
  syncModes();

  let names = house.modes().map((s) => `${s.id}:${s.name}`).join('|');
  house.onChange(() => {
    const now = house.modes().map((s) => `${s.id}:${s.name}`).join('|');
    if (now !== names) {
      names = now;
      syncModes();
    }
    lights.forEach((l) => l.refresh());
    outlets.forEach((o) => o.refresh());
    modes.forEach((m) => m.refresh());
  });

  bridge.publish({ username: p.username, pincode: p.pincode, setupID: p.setupID, port: 51826, category: Categories.BRIDGE });

  console.log(`HomeKit: «Casa Marsiana» con ${lights.length} luz/luces, ${outlets.length} enchufe(s) y ${modes.size} modos · código ${p.pincode}`);
  if (!bridge._accessoryInfo?.paired()) {
    console.log('Para añadirla: app Casa → + → Añadir accesorio → escanea esto (o «Más opciones» y el código)');
    qrcode.generate(bridge.setupURI(), { small: true });
  }
}
