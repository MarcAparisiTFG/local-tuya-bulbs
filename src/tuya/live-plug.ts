// Prueba real contra el enchufe (protocolo 3.4) desde Node: npx tsx src/tuya/live-plug.ts
// Sólo lee su estado. Con --toggle2 apaga la toma 2 y la vuelve a encender. No imprime la clave.
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { Connect, TuyaDevice, TuyaVersion } from './device';

type Dev = { id: string; name: string; ip: string; key: string; version?: string; category?: string };
const devices: Dev[] = JSON.parse(readFileSync(new URL('../../devices.json', import.meta.url), 'utf8'));
const dev = devices.find((d) => d.category === 'pc');
if (!dev) throw new Error('No hay ningún enchufe en devices.json');

const connect: Connect = (host, port, onConnect) => net.connect({ host, port }, onConnect) as unknown as ReturnType<Connect>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const d = new TuyaDevice(dev!.id, dev!.ip, dev!.key, connect, (dev!.version ?? '3.4') as TuyaVersion);
  d.onStatus = (dps) => console.log('  (aviso del enchufe)', JSON.stringify(dps));
  await d.connect();
  console.log('Conectado a', dev!.name, dev!.ip);
  console.log('Estado:', JSON.stringify(await d.getStatus()));
  if (process.argv.includes('--toggle2')) {
    await d.setDps({ '2': false });
    console.log('OK: toma 2 apagada');
    await sleep(1500);
    await d.setDps({ '2': true });
    console.log('OK: toma 2 encendida');
    await sleep(1000);
    console.log('Estado:', JSON.stringify(await d.getStatus()));
  }
  d.close();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
