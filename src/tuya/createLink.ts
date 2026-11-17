import { Connect, TuyaDevice } from './device';
import { Link, LinkTarget } from './link';
import { createBridgeLink } from './bridgeLink';
import { getBridgeUrl, getMode } from './mode';
import { createSimLink } from './simLink';
import { HAS_TCP } from './sockets';

export async function createLink(b: LinkTarget): Promise<Link> {
  if (getMode() === 'bridge') return createBridgeLink(b, getBridgeUrl());
  if (!HAS_TCP) return createSimLink(b);
  // Se carga aquí y no arriba: sin el módulo nativo (Expo Go), sólo importarlo ya rompe la app
  const TcpSocket = require('react-native-tcp-socket');
  const connect: Connect = (host, port, onConnect) => TcpSocket.createConnection({ host, port }, onConnect);
  const d = new TuyaDevice(b.id, b.ip, b.key, connect, b.version);
  await d.connect();
  return d;
}
