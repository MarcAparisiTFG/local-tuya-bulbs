// Prueba real contra la bombilla desde Node: npx tsx src/tuya/live-test.ts
// Lee id, ip y local_key de ../devices.json (generado por `tinytuya wizard`). No imprime la clave.
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { setBrightness, setColour, setPower, setWhiteTemp } from './bulb';
import { Connect, TuyaDevice } from './device';

const [dev] = JSON.parse(readFileSync(new URL('../../devices.json', import.meta.url), 'utf8'));

const connect: Connect = (host, port, onConnect) => {
  const s = net.connect({ host, port }, onConnect);
  return s as unknown as ReturnType<Connect>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const d = new TuyaDevice(dev.id, dev.ip, dev.key, connect);
d.onStatus = (dps) => console.log('  (aviso de la bombilla)', JSON.stringify(dps));

async function main() {
  await d.connect();
  console.log('Conectado a', dev.name, dev.ip);
  console.log('Estado inicial:', JSON.stringify(await d.getStatus()));

  const steps: [string, () => Promise<void>][] = [
    ['Encender', () => setPower(d, true)],
    ['Blanco frío, brillo 100%', async () => { await setWhiteTemp(d, 100); await setBrightness(d, 100); }],
    ['Rojo', () => setColour(d, 0)],
    ['Verde', () => setColour(d, 120)],
    ['Azul', () => setColour(d, 240)],
    ['Blanco cálido, brillo 40%', async () => { await setWhiteTemp(d, 0); await setBrightness(d, 40); }],
  ];
  for (const [name, fn] of steps) {
    await fn();
    console.log('OK:', name);
    await sleep(1500);
  }
  console.log('Estado final:', JSON.stringify(await d.getStatus()));
  d.close();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
