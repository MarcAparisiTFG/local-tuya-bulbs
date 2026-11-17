// Sólo lee el estado de la bombilla real, sin cambiar nada: npx tsx src/tuya/live-status.ts
import { readFileSync } from 'node:fs';
import net from 'node:net';
import { lookFromDps, lookToDps } from '../look';
import { Connect, TuyaDevice } from './device';

const [dev] = JSON.parse(readFileSync(new URL('../../devices.json', import.meta.url), 'utf8'));
const connect: Connect = (host, port, onConnect) => net.connect({ host, port }, onConnect) as unknown as ReturnType<Connect>;

async function main() {
  const d = new TuyaDevice(dev.id, dev.ip, dev.key, connect);
  await d.connect();
  const dps = await d.getStatus();
  const look = lookFromDps(dps);
  console.log('DPS de la bombilla:', JSON.stringify(dps));
  console.log('Como lo ve la app: ', JSON.stringify(look));
  console.log('Lo que mandaría:   ', JSON.stringify(lookToDps(look)));
  d.close();
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
